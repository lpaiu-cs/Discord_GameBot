import { Client, Guild, GuildMember } from "discord.js";
import {
  GameDeliveryMode,
  InMemoryGameRegistry,
  MafiaGame,
  WebChatChannel,
  WebChatMessage,
  WebPrivateLogEntry,
  AudioCueKey,
} from "./game";
import {
  NightActionRecord,
  PendingArticle,
  PendingTrialBurn,
  Phase,
  PhaseContext,
  PlayerState,
  Ruleset,
  SecretChannelIds,
} from "./model";
import { JsonFileStore } from "../persistence/json-file-store";

interface PersistentGameRegistryOptions {
  filePath: string;
  deliveryMode: GameDeliveryMode;
  onEnded?: (game: MafiaGame) => void;
}

interface PersistentGameRegistrySnapshot {
  games: MafiaGameSnapshot[];
}

interface MafiaGameSnapshot {
  id: string;
  guildId: string;
  channelId: string;
  hostId: string;
  ruleset: Ruleset;
  players: PlayerState[];
  secretChannels: SecretChannelIds;
  nightActions: NightActionRecord[];
  bonusNightActions: NightActionRecord[];
  spyBonusGrantedTonight: string[];
  dayVotes: Array<[string, string]>;
  trialVotes: Array<[string, "yes" | "no"]>;
  pendingTrialBurns: PendingTrialBurn[];
  deadOrder: string[];
  webChats: Record<WebChatChannel, WebChatMessage[]>;
  privateLogs: Array<[string, WebPrivateLogEntry[]]>;
  audioCues: PersistedAudioCue[];
  phase: Phase;
  phaseContext: PhaseContext | null;
  dayNumber: number;
  nightNumber: number;
  currentTrialTargetId: string | null;
  blockedTonightTargetId: string | null;
  pendingSeductionTargetId: string | null;
  bulliedToday: string[];
  bulliedNextDay: string[];
  pendingArticle: PendingArticle | null;
  lastPublicLines: string[];
  endedWinner: string | null;
  endedReason: string | null;
  lobbyMessageId: string | null;
  statusMessageId: string | null;
  phaseMessageId: string | null;
  loverPair: [string, string] | null;
  stateVersion: number;
}

interface PersistedAudioCue {
  id: string;
  key: AudioCueKey;
  createdAt: number;
  recipientIds: string[] | null;
}

export class PersistentGameRegistry extends InMemoryGameRegistry {
  private readonly fileStore: JsonFileStore<PersistentGameRegistrySnapshot>;
  private readonly deliveryMode: GameDeliveryMode;
  private persistTimer: NodeJS.Timeout | null = null;

  constructor(options: PersistentGameRegistryOptions) {
    super(options.onEnded);
    this.fileStore = new JsonFileStore(options.filePath, "game registry");
    this.deliveryMode = options.deliveryMode;
    this.loadSnapshot(this.fileStore.read({ games: [] }));
  }

  override create(guild: Guild, channelId: string, host: GuildMember, ruleset: Ruleset): MafiaGame {
    const game = super.create(guild, channelId, host, ruleset);
    this.schedulePersist();
    return game;
  }

  override delete(guildId: string): void {
    super.delete(guildId);
    this.schedulePersist();
  }

  public getAllGames(): MafiaGame[] {
    return [...this.games.values()];
  }

  public async restoreActiveTimers(client: Client): Promise<void> {
    for (const game of this.games.values()) {
      game.clearTimer();

      if (game.phase === "lobby" || game.phase === "ended" || !game.phaseContext) {
        continue;
      }

      const remainingMs = game.phaseContext.deadlineAt - Date.now();
      if (remainingMs <= 0) {
        await this.advanceRecoveredGame(game, client);
        continue;
      }

      game.restartTimer(client, remainingMs, () => game.forceAdvance(client));
    }
  }

  public async flush(): Promise<void> {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
      this.persistTimer = null;
      this.fileStore.scheduleWrite({
        games: [...this.games.values()].map((game) => snapshotGame(game)),
      });
    }

    await this.fileStore.flush();
  }

  protected override handleGameStateChange(game: MafiaGame): void {
    this.schedulePersist();
    super.handleGameStateChange(game);
  }

  private async advanceRecoveredGame(game: MafiaGame, client: Client): Promise<void> {
    try {
      await game.forceAdvance(client);
    } catch (error) {
      console.error(`failed to advance recovered game ${game.id}`, error);
      await game.end(client, "복구 중 단계를 재개하지 못해 게임을 종료했습니다.");
    }
  }

  private schedulePersist(): void {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }

    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.fileStore.scheduleWrite({
        games: [...this.games.values()].map((game) => snapshotGame(game)),
      });
    }, 100);
    this.persistTimer.unref?.();
  }

  private loadSnapshot(snapshot: PersistentGameRegistrySnapshot): void {
    this.games.clear();
    for (const gameSnapshot of snapshot.games) {
      const game = restoreGame(gameSnapshot, this.deliveryMode, (guildId) => {
        const endedGame = this.games.get(guildId);
        if (endedGame) {
          this.onEnded?.(endedGame);
        }
      }, (gameState) => this.handleGameStateChange(gameState));
      this.games.set(game.guildId, game);
    }
  }
}

function snapshotGame(game: MafiaGame): MafiaGameSnapshot {
  return {
    id: game.id,
    guildId: game.guildId,
    channelId: game.channelId,
    hostId: game.hostId,
    ruleset: game.ruleset,
    players: [...game.players.values()].map((player) => ({ ...player })),
    secretChannels: { ...game.secretChannels },
    nightActions: [...game.nightActions.values()].map((record) => ({ ...record })),
    bonusNightActions: [...game.bonusNightActions.values()].map((record) => ({ ...record })),
    spyBonusGrantedTonight: [...game.spyBonusGrantedTonight],
    dayVotes: [...game.dayVotes.entries()],
    trialVotes: [...game.trialVotes.entries()],
    pendingTrialBurns: [...game.pendingTrialBurns.values()].map((burn) => ({ ...burn })),
    deadOrder: [...game.deadOrder],
    webChats: {
      public: game.webChats.public.map((message) => ({ ...message })),
      mafia: game.webChats.mafia.map((message) => ({ ...message })),
      lover: game.webChats.lover.map((message) => ({ ...message })),
      graveyard: game.webChats.graveyard.map((message) => ({ ...message })),
    },
    privateLogs: [...game.privateLogs.entries()].map(([userId, entries]) => [
      userId,
      entries.map((entry) => ({ ...entry })),
    ]),
    audioCues: game.audioCues.map((cue) => ({
      id: cue.id,
      key: cue.key,
      createdAt: cue.createdAt,
      recipientIds: cue.recipientIds ? [...cue.recipientIds] : null,
    })),
    phase: game.phase,
    phaseContext: game.phaseContext ? { ...game.phaseContext } : null,
    dayNumber: game.dayNumber,
    nightNumber: game.nightNumber,
    currentTrialTargetId: game.currentTrialTargetId,
    blockedTonightTargetId: game.blockedTonightTargetId,
    pendingSeductionTargetId: game.pendingSeductionTargetId,
    bulliedToday: [...game.bulliedToday],
    bulliedNextDay: [...game.bulliedNextDay],
    pendingArticle: game.pendingArticle ? { ...game.pendingArticle } : null,
    lastPublicLines: [...game.lastPublicLines],
    endedWinner: game.endedWinner,
    endedReason: game.endedReason,
    lobbyMessageId: game.lobbyMessageId,
    statusMessageId: game.statusMessageId,
    phaseMessageId: game.phaseMessageId,
    loverPair: game.loverPair ? [...game.loverPair] as [string, string] : null,
    stateVersion: game.stateVersion,
  };
}

function restoreGame(
  snapshot: MafiaGameSnapshot,
  deliveryMode: GameDeliveryMode,
  onEnded: (guildId: string) => void,
  onStateChange: (game: MafiaGame) => void,
): MafiaGame {
  const hostSeed = snapshot.players.find((player) => player.userId === snapshot.hostId);
  const host = {
    id: snapshot.hostId,
    displayName: hostSeed?.displayName ?? snapshot.hostId,
    user: { bot: false },
  } as GuildMember;

  const game = new MafiaGame(
    { id: snapshot.guildId } as Guild,
    snapshot.channelId,
    host,
    snapshot.ruleset,
    onEnded,
    deliveryMode,
    onStateChange,
  ) as MafiaGame & { id: string };

  game.id = snapshot.id;
  game.players.clear();
  for (const player of snapshot.players) {
    game.players.set(player.userId, { ...player });
  }
  game.contactedIds.clear();
  snapshot.players
    .filter((player) => player.isContacted)
    .forEach((player) => game.contactedIds.add(player.userId));

  Object.assign(game.secretChannels, snapshot.secretChannels);

  game.nightActions.clear();
  for (const record of snapshot.nightActions) {
    game.nightActions.set(record.actorId, { ...record });
  }

  game.bonusNightActions.clear();
  for (const record of snapshot.bonusNightActions) {
    game.bonusNightActions.set(record.actorId, { ...record });
  }

  game.spyBonusGrantedTonight.clear();
  snapshot.spyBonusGrantedTonight.forEach((userId) => game.spyBonusGrantedTonight.add(userId));

  game.dayVotes.clear();
  snapshot.dayVotes.forEach(([userId, targetId]) => game.dayVotes.set(userId, targetId));

  game.trialVotes.clear();
  snapshot.trialVotes.forEach(([userId, vote]) => game.trialVotes.set(userId, vote));

  game.pendingTrialBurns.clear();
  snapshot.pendingTrialBurns.forEach((burn) => game.pendingTrialBurns.set(burn.actorId, { ...burn }));

  game.deadOrder.length = 0;
  game.deadOrder.push(...snapshot.deadOrder);

  restoreChatChannel(game, "public", snapshot.webChats.public);
  restoreChatChannel(game, "mafia", snapshot.webChats.mafia);
  restoreChatChannel(game, "lover", snapshot.webChats.lover);
  restoreChatChannel(game, "graveyard", snapshot.webChats.graveyard);

  game.privateLogs.clear();
  snapshot.privateLogs.forEach(([userId, entries]) => {
    game.privateLogs.set(userId, entries.map((entry) => ({ ...entry })));
  });

  game.audioCues.length = 0;
  snapshot.audioCues.forEach((cue) => {
    game.audioCues.push({
      id: cue.id,
      key: cue.key,
      createdAt: cue.createdAt,
      recipientIds: cue.recipientIds ? [...cue.recipientIds] : null,
    });
  });

  game.phase = snapshot.phase;
  game.phaseContext = snapshot.phaseContext ? { ...snapshot.phaseContext } : null;
  game.dayNumber = snapshot.dayNumber;
  game.nightNumber = snapshot.nightNumber;
  game.currentTrialTargetId = snapshot.currentTrialTargetId;
  game.blockedTonightTargetId = snapshot.blockedTonightTargetId;
  game.pendingSeductionTargetId = snapshot.pendingSeductionTargetId;
  game.bulliedToday = new Set(snapshot.bulliedToday);
  game.bulliedNextDay = new Set(snapshot.bulliedNextDay);
  game.pendingArticle = snapshot.pendingArticle ? { ...snapshot.pendingArticle } : null;
  game.lastPublicLines = [...snapshot.lastPublicLines];
  game.endedWinner = snapshot.endedWinner;
  game.endedReason = snapshot.endedReason;
  game.lobbyMessageId = snapshot.lobbyMessageId;
  game.statusMessageId = snapshot.statusMessageId;
  game.phaseMessageId = snapshot.phaseMessageId;
  game.loverPair = snapshot.loverPair ? [...snapshot.loverPair] as [string, string] : null;
  game.pendingAftermathChoice = null;
  game.phaseTimer = null;
  game.stateVersion = snapshot.stateVersion;

  return game;
}

function restoreChatChannel(game: MafiaGame, channel: WebChatChannel, messages: WebChatMessage[]): void {
  game.webChats[channel].length = 0;
  messages.forEach((message) => {
    game.webChats[channel].push({ ...message });
  });
}
