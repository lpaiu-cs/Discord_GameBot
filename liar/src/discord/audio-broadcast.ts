import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  AudioPlayer,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
} from "@discordjs/voice";
import { Client, Guild } from "discord.js";
import { LiarGame } from "../engine/game";

const ffmpegPath = require("ffmpeg-static") as string | null;

type LoopTrackKey = "lobby" | "discussion" | "guess";
type OneShotTrackKey = "join" | "start" | "citizensWin" | "liarWin";
type TrackKey = LoopTrackKey | OneShotTrackKey;

interface QueuedTrack {
  readonly key: OneShotTrackKey;
  readonly disconnectAfter: boolean;
}

interface BroadcastSession {
  readonly guildId: string;
  connection: VoiceConnection;
  readonly player: AudioPlayer;
  channelId: string;
  loopTrackKey: LoopTrackKey | null;
  activeTrackKey: TrackKey | null;
  activeLoop: boolean;
  activeProcess: ReturnType<typeof spawn> | null;
  readonly queue: QueuedTrack[];
  disconnectWhenIdle: boolean;
}

export interface LiarAudioContext {
  readonly guild?: Guild | null;
  readonly hostVoiceChannelId?: string | null;
}

export interface LiarAudioController {
  syncPhase(client: Client, game: LiarGame, context?: LiarAudioContext): Promise<void>;
  playLobbyJoin(client: Client, game: LiarGame, context?: LiarAudioContext): Promise<void>;
  playGameStart(client: Client, game: LiarGame, context?: LiarAudioContext): Promise<void>;
  destroy(guildId: string): Promise<void>;
}

const TRACK_FILES: Record<TrackKey, string> = {
  lobby: "bgm_lobby.mp3",
  discussion: "bgm_discussion.mp3",
  guess: "bgm_guess.mp3",
  join: "sfx_join.mp3",
  start: "sfx_start.mp3",
  citizensWin: "bgm_citizen_win.mp3",
  liarWin: "bgm_liar_win.mp3",
};

const AUDIO_ROOT_CANDIDATES = [
  resolve(__dirname, "../../resource/audio"),
  resolve(__dirname, "../../../../liar/resource/audio"),
];

function resolveAudioPath(filename: string): string {
  for (const root of AUDIO_ROOT_CANDIDATES) {
    const candidate = resolve(root, filename);
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`라이어 오디오 파일을 찾을 수 없습니다: ${filename}`);
}

function phaseLoopTrack(game: LiarGame): LoopTrackKey | null {
  switch (game.phase) {
    case "lobby":
      return "lobby";
    case "clue":
    case "discussion":
    case "voting":
      return "discussion";
    case "guess":
      return "guess";
    default:
      return null;
  }
}

function resultTrack(game: LiarGame): OneShotTrackKey | null {
  if (!game.result) {
    return null;
  }

  switch (game.result.winner) {
    case "citizens":
      return "citizensWin";
    case "liar":
      return "liarWin";
    default:
      return null;
  }
}

export class NoopLiarAudioController implements LiarAudioController {
  async syncPhase(): Promise<void> {}
  async playLobbyJoin(): Promise<void> {}
  async playGameStart(): Promise<void> {}
  async destroy(): Promise<void> {}
}

export class DiscordVoiceLiarAudioController implements LiarAudioController {
  private readonly sessions = new Map<string, BroadcastSession>();

  async syncPhase(client: Client, game: LiarGame, context: LiarAudioContext = {}): Promise<void> {
    const winnerTrack = game.phase === "ended" ? resultTrack(game) : null;
    const loopTrackKey = phaseLoopTrack(game);

    if (game.phase === "ended" && !winnerTrack) {
      await this.destroy(game.guildId);
      return;
    }

    const playback = await this.resolvePlaybackContext(client, game, context);
    if (!playback) {
      await this.destroy(game.guildId);
      return;
    }

    const session = await this.ensureSession(playback.guild, playback.channelId);

    if (winnerTrack) {
      session.loopTrackKey = null;
      session.queue.length = 0;
      session.disconnectWhenIdle = true;
      this.enqueueTrack(session, winnerTrack, true);
      return;
    }

    session.disconnectWhenIdle = false;
    this.setLoopTrack(session, loopTrackKey);
  }

  async playLobbyJoin(client: Client, game: LiarGame, context: LiarAudioContext = {}): Promise<void> {
    if (game.phase !== "lobby") {
      return;
    }

    const playback = await this.resolvePlaybackContext(client, game, context);
    if (!playback) {
      return;
    }

    const session = await this.ensureSession(playback.guild, playback.channelId);
    this.setLoopTrack(session, "lobby");
    this.enqueueTrack(session, "join", false);
  }

  async playGameStart(client: Client, game: LiarGame, context: LiarAudioContext = {}): Promise<void> {
    const playback = await this.resolvePlaybackContext(client, game, context);
    if (!playback) {
      return;
    }

    const session = await this.ensureSession(playback.guild, playback.channelId);
    this.setLoopTrack(session, phaseLoopTrack(game));
    this.enqueueTrack(session, "start", false);
  }

  async destroy(guildId: string): Promise<void> {
    const session = this.sessions.get(guildId);
    if (!session) {
      return;
    }

    session.queue.length = 0;
    session.loopTrackKey = null;
    session.activeTrackKey = null;
    session.activeLoop = false;
    session.disconnectWhenIdle = false;
    this.stopActiveProcess(session);
    session.player.stop(true);
    session.connection.destroy();
    this.sessions.delete(guildId);
  }

  private async resolvePlaybackContext(
    client: Client,
    game: LiarGame,
    context: LiarAudioContext,
  ): Promise<{ guild: Guild; channelId: string } | null> {
    const guild = context.guild ?? (await this.resolveGuild(client, game.channelId));
    if (!guild) {
      return null;
    }

    const channelId = context.hostVoiceChannelId ?? (await this.resolveHostVoiceChannelId(guild, game.hostId));
    if (!channelId) {
      return null;
    }

    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isVoiceBased()) {
      return null;
    }

    return { guild, channelId };
  }

  private async resolveGuild(client: Client, textChannelId: string): Promise<Guild | null> {
    const channel = await client.channels.fetch(textChannelId);
    if (!channel || !("guild" in channel)) {
      return null;
    }

    return channel.guild ?? null;
  }

  private async resolveHostVoiceChannelId(guild: Guild, hostId: string): Promise<string | null> {
    const member = await guild.members.fetch(hostId);
    return member.voice.channelId ?? null;
  }

  private async ensureSession(guild: Guild, channelId: string): Promise<BroadcastSession> {
    const existing = this.sessions.get(guild.id);
    if (existing && existing.channelId === channelId && existing.connection.state.status !== VoiceConnectionStatus.Destroyed) {
      return existing;
    }

    if (existing) {
      await this.destroy(guild.id);
    }

    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause,
      },
    });
    const connection = joinVoiceChannel({
      guildId: guild.id,
      channelId,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    connection.subscribe(player);

    const session: BroadcastSession = {
      guildId: guild.id,
      connection,
      player,
      channelId,
      loopTrackKey: null,
      activeTrackKey: null,
      activeLoop: false,
      activeProcess: null,
      queue: [],
      disconnectWhenIdle: false,
    };

    player.on(AudioPlayerStatus.Idle, () => {
      void this.advancePlayback(session);
    });
    player.on("error", (error) => {
      console.error(`failed to play liar audio in guild ${guild.id}`, error);
      this.stopActiveProcess(session);
      session.activeTrackKey = null;
      session.activeLoop = false;
      void this.advancePlayback(session);
    });

    connection.on("error", (error) => {
      console.error(`liar voice connection error in guild ${guild.id}`, error);
    });

    this.sessions.set(guild.id, session);
    return session;
  }

  private setLoopTrack(session: BroadcastSession, key: LoopTrackKey | null): void {
    session.loopTrackKey = key;
    if (!key) {
      if (session.activeLoop) {
        session.player.stop(true);
      }
      return;
    }

    if (session.activeTrackKey === key && session.activeLoop && session.queue.length === 0) {
      return;
    }

    if (session.activeTrackKey === null && session.queue.length === 0) {
      void this.advancePlayback(session);
      return;
    }

    if (session.activeLoop && session.activeTrackKey !== key && session.queue.length === 0) {
      session.player.stop(true);
    }
  }

  private enqueueTrack(session: BroadcastSession, key: OneShotTrackKey, disconnectAfter: boolean): void {
    session.queue.push({ key, disconnectAfter });

    if (session.activeTrackKey === null) {
      void this.advancePlayback(session);
      return;
    }

    if (session.activeLoop) {
      session.player.stop(true);
    }
  }

  private async advancePlayback(session: BroadcastSession): Promise<void> {
    this.stopActiveProcess(session);
    session.activeTrackKey = null;
    session.activeLoop = false;

    const queued = session.queue.shift();
    if (queued) {
      session.disconnectWhenIdle = queued.disconnectAfter;
      this.playTrack(session, queued.key, false);
      return;
    }

    if (session.loopTrackKey) {
      session.disconnectWhenIdle = false;
      this.playTrack(session, session.loopTrackKey, true);
      return;
    }

    if (session.disconnectWhenIdle) {
      await this.destroy(session.guildId);
    }
  }

  private playTrack(session: BroadcastSession, key: TrackKey, loop: boolean): void {
    const { resource, process } = this.createTrackResource(key);
    session.activeTrackKey = key;
    session.activeLoop = loop;
    session.activeProcess = process;
    session.player.play(resource);
  }

  private createTrackResource(key: TrackKey): {
    resource: ReturnType<typeof createAudioResource>;
    process: ReturnType<typeof spawn>;
  } {
    const executable = ffmpegPath ?? "ffmpeg";
    const filePath = resolveAudioPath(TRACK_FILES[key]);
    const process = spawn(
      executable,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        filePath,
        "-f",
        "s16le",
        "-ar",
        "48000",
        "-ac",
        "2",
        "pipe:1",
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );

    if (!process.stdout) {
      throw new Error("라이어 오디오 ffmpeg stdout 파이프를 열지 못했습니다.");
    }

    const resource = createAudioResource(process.stdout, {
      inputType: StreamType.Raw,
    });

    return { resource, process };
  }

  private stopActiveProcess(session: BroadcastSession): void {
    const current = session.activeProcess;
    session.activeProcess = null;
    if (!current || current.killed) {
      return;
    }

    current.kill("SIGKILL");
  }
}
