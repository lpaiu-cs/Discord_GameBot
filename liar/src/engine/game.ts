import { randomUUID } from "node:crypto";
import { getDefaultLiarCategory, getLiarCategory, LiarCategory } from "../content/categories";
import {
  LiarClue,
  LiarClueSubmissionResult,
  LiarKeywordView,
  LiarPhase,
  LiarPlayer,
  LiarResult,
  LiarVote,
  LiarVoteResolution,
} from "./model";

const MIN_PLAYERS = 4;
const MAX_PLAYERS = 8;
const MAX_CLUE_LENGTH = 120;
const MAX_GUESS_LENGTH = 60;

type RandomSource = () => number;

function normalizeWord(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function assertNonEmpty(value: string, message: string, maxLength: number): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(message);
  }

  if (trimmed.length > maxLength) {
    throw new Error(`입력은 ${maxLength}자 이하만 가능합니다.`);
  }

  return trimmed;
}

function shuffle<T>(items: readonly T[], random: RandomSource): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export class LiarGame {
  readonly id = randomUUID();
  readonly guildId: string;
  readonly guildName: string;
  readonly channelId: string;
  hostId: string;
  phase: LiarPhase = "lobby";
  readonly players = new Map<string, LiarPlayer>();
  readonly clues: LiarClue[] = [];
  readonly votes = new Map<string, LiarVote>();
  readonly createdAt = Date.now();
  categoryId: string;
  statusMessageId: string | null = null;
  liarId: string | null = null;
  secretWord: string | null = null;
  turnOrder: string[] = [];
  currentTurnIndex = 0;
  accusedUserId: string | null = null;
  result: LiarResult | null = null;
  startedAt: number | null = null;

  constructor(params: {
    guildId: string;
    guildName?: string | null;
    channelId: string;
    hostId: string;
    hostDisplayName: string;
    categoryId?: string;
  }) {
    this.guildId = params.guildId;
    this.guildName = params.guildName ?? "";
    this.channelId = params.channelId;
    this.hostId = params.hostId;
    this.categoryId = params.categoryId ?? getDefaultLiarCategory().id;
    this.players.set(params.hostId, {
      userId: params.hostId,
      displayName: params.hostDisplayName,
      joinedAt: this.createdAt,
    });
  }

  get playerCount(): number {
    return this.players.size;
  }

  get category(): LiarCategory {
    return getLiarCategory(this.categoryId) ?? getDefaultLiarCategory();
  }

  isParticipant(userId: string): boolean {
    return this.players.has(userId);
  }

  getPlayer(userId: string): LiarPlayer | null {
    return this.players.get(userId) ?? null;
  }

  getCurrentSpeaker(): LiarPlayer | null {
    const userId = this.turnOrder[this.currentTurnIndex];
    return userId ? this.getPlayer(userId) : null;
  }

  addPlayer(userId: string, displayName: string): void {
    if (this.phase !== "lobby") {
      throw new Error("게임이 이미 시작되어 참가할 수 없습니다.");
    }

    if (this.players.has(userId)) {
      throw new Error("이미 참가한 플레이어입니다.");
    }

    if (this.players.size >= MAX_PLAYERS) {
      throw new Error(`라이어게임은 최대 ${MAX_PLAYERS}명까지 참가할 수 있습니다.`);
    }

    this.players.set(userId, {
      userId,
      displayName,
      joinedAt: Date.now(),
    });
  }

  removePlayer(userId: string): void {
    if (this.phase !== "lobby") {
      throw new Error("게임이 시작된 뒤에는 나갈 수 없습니다. 방장이 게임을 종료하세요.");
    }

    if (!this.players.delete(userId)) {
      throw new Error("현재 로비 참가자가 아닙니다.");
    }

    if (this.hostId === userId) {
      const nextHost = [...this.players.values()].sort((left, right) => left.joinedAt - right.joinedAt)[0] ?? null;
      this.hostId = nextHost?.userId ?? "";
    }
  }

  setCategory(categoryId: string): void {
    if (this.phase !== "lobby") {
      throw new Error("카테고리는 로비에서만 바꿀 수 있습니다.");
    }

    if (!getLiarCategory(categoryId)) {
      throw new Error("지원하지 않는 카테고리입니다.");
    }

    this.categoryId = categoryId;
  }

  start(random: RandomSource = Math.random): void {
    if (this.phase !== "lobby") {
      throw new Error("이미 시작된 게임입니다.");
    }

    if (this.players.size < MIN_PLAYERS || this.players.size > MAX_PLAYERS) {
      throw new Error(`라이어게임은 ${MIN_PLAYERS}명 이상 ${MAX_PLAYERS}명 이하로만 시작할 수 있습니다.`);
    }

    const participants = [...this.players.values()].sort((left, right) => left.joinedAt - right.joinedAt);
    const liarIndex = Math.floor(random() * participants.length);
    const keywordIndex = Math.floor(random() * this.category.words.length);
    this.liarId = participants[liarIndex].userId;
    this.secretWord = this.category.words[keywordIndex];
    this.turnOrder = shuffle(participants.map((player) => player.userId), random);
    this.phase = "clue";
    this.currentTurnIndex = 0;
    this.startedAt = Date.now();
    this.clues.length = 0;
    this.votes.clear();
    this.accusedUserId = null;
    this.result = null;
  }

  getKeywordView(userId: string): LiarKeywordView {
    if (!this.isParticipant(userId)) {
      throw new Error("현재 라이어게임 참가자만 제시어를 확인할 수 있습니다.");
    }

    if (!this.secretWord || !this.liarId || this.phase === "lobby") {
      throw new Error("아직 게임이 시작되지 않았습니다.");
    }

    if (userId === this.liarId) {
      return {
        categoryLabel: this.category.label,
        isLiar: true,
        keyword: null,
        message: `당신은 라이어입니다. 카테고리는 ${this.category.label}이며 제시어는 공개되지 않습니다.`,
      };
    }

    return {
      categoryLabel: this.category.label,
      isLiar: false,
      keyword: this.secretWord,
      message: `카테고리: ${this.category.label}\n제시어: ${this.secretWord}`,
    };
  }

  submitClue(userId: string, content: string): LiarClueSubmissionResult {
    if (this.phase !== "clue") {
      throw new Error("지금은 제시어 설명 단계가 아닙니다.");
    }

    const speaker = this.getCurrentSpeaker();
    if (!speaker || speaker.userId !== userId) {
      throw new Error("지금 설명할 차례가 아닙니다.");
    }

    const sanitized = assertNonEmpty(content, "설명 문장은 비워 둘 수 없습니다.", MAX_CLUE_LENGTH);
    this.clues.push({
      userId,
      displayName: speaker.displayName,
      content: sanitized,
      submittedAt: Date.now(),
      order: this.clues.length + 1,
    });
    this.currentTurnIndex += 1;

    if (this.currentTurnIndex >= this.turnOrder.length) {
      this.phase = "discussion";
      return { phaseChanged: true, nextSpeakerId: null };
    }

    return {
      phaseChanged: false,
      nextSpeakerId: this.turnOrder[this.currentTurnIndex] ?? null,
    };
  }

  beginVote(): void {
    if (this.phase !== "discussion") {
      throw new Error("투표는 설명이 모두 끝난 뒤 토론 단계에서만 열 수 있습니다.");
    }

    this.phase = "voting";
    this.votes.clear();
  }

  submitVote(userId: string, targetId: string): { completed: boolean; progress: number; resolution: LiarVoteResolution | null } {
    if (this.phase !== "voting") {
      throw new Error("지금은 투표 단계가 아닙니다.");
    }

    if (!this.isParticipant(userId)) {
      throw new Error("현재 라이어게임 참가자만 투표할 수 있습니다.");
    }

    if (!this.isParticipant(targetId)) {
      throw new Error("현재 참가자만 지목할 수 있습니다.");
    }

    if (this.votes.has(userId)) {
      throw new Error("이미 투표했습니다.");
    }

    this.votes.set(userId, {
      voterId: userId,
      targetId,
      submittedAt: Date.now(),
    });

    if (this.votes.size < this.players.size) {
      return {
        completed: false,
        progress: this.votes.size,
        resolution: null,
      };
    }

    return {
      completed: true,
      progress: this.votes.size,
      resolution: this.resolveVotes(),
    };
  }

  tallyVotes(): LiarVoteResolution {
    if (this.phase !== "voting") {
      throw new Error("지금은 투표를 집계할 수 없습니다.");
    }

    if (this.votes.size === 0) {
      throw new Error("아직 제출된 투표가 없습니다.");
    }

    return this.resolveVotes();
  }

  guessWord(userId: string, guess: string): LiarResult {
    if (this.phase !== "guess") {
      throw new Error("지금은 라이어 추리 단계가 아닙니다.");
    }

    if (userId !== this.liarId) {
      throw new Error("라이어만 제시어를 추리할 수 있습니다.");
    }

    const sanitized = assertNonEmpty(guess, "추리 단어를 입력하세요.", MAX_GUESS_LENGTH);
    const isCorrect = normalizeWord(sanitized) === normalizeWord(this.secretWord ?? "");
    const result: LiarResult = isCorrect
      ? {
          winner: "liar",
          reason: `라이어가 제시어 ${this.secretWord} 를 맞혀 승리했습니다.`,
          accusedUserId: this.accusedUserId,
          guessedWord: sanitized,
        }
      : {
          winner: "citizens",
          reason: `라이어가 ${sanitized} 라고 추리했지만 제시어는 ${this.secretWord} 였습니다.`,
          accusedUserId: this.accusedUserId,
          guessedWord: sanitized,
        };
    this.phase = "ended";
    this.result = result;
    return result;
  }

  forceEnd(reason: string): LiarResult {
    const result: LiarResult = {
      winner: "liar",
      reason,
      accusedUserId: this.accusedUserId,
      guessedWord: null,
    };
    this.phase = "ended";
    this.result = result;
    return result;
  }

  describeParticipants(): string {
    return [...this.players.values()]
      .sort((left, right) => left.joinedAt - right.joinedAt)
      .map((player) => `${player.userId === this.hostId ? "[방장] " : ""}${player.displayName}`)
      .join(", ");
  }

  describeTurnOrder(): string {
    if (this.turnOrder.length === 0) {
      return "아직 없음";
    }

    return this.turnOrder
      .map((userId, index) => {
        const player = this.getPlayer(userId);
        return `${index + 1}. ${player?.displayName ?? userId}`;
      })
      .join("\n");
  }

  describeStatus(): string {
    const header = [
      `라이어게임 상태: ${phaseLabel(this.phase)}`,
      `카테고리: ${this.category.label}`,
      `참가자(${this.players.size}명): ${this.describeParticipants() || "없음"}`,
    ];

    if (this.phase === "clue") {
      const speaker = this.getCurrentSpeaker();
      header.push(`현재 차례: ${speaker?.displayName ?? "없음"}`);
      header.push(`설명 진행: ${this.clues.length}/${this.turnOrder.length}`);
    }

    if (this.phase === "discussion") {
      header.push("토론 중입니다. 방장이 `/liar begin-vote` 로 투표를 시작하세요.");
    }

    if (this.phase === "voting") {
      header.push(`투표 진행: ${this.votes.size}/${this.players.size}`);
    }

    if (this.phase === "guess") {
      const liar = this.liarId ? this.getPlayer(this.liarId) : null;
      header.push(`라이어 추리 단계: ${liar?.displayName ?? "알 수 없음"} 님의 답변 대기 중`);
    }

    if (this.phase === "ended" && this.result) {
      header.push(`결과: ${this.result.reason}`);
    }

    return header.join("\n");
  }

  private resolveVotes(): LiarVoteResolution {
    const counts = new Map<string, number>();
    for (const vote of this.votes.values()) {
      counts.set(vote.targetId, (counts.get(vote.targetId) ?? 0) + 1);
    }

    const ranked = [...counts.entries()].sort((left, right) => right[1] - left[1]);
    const highest = ranked[0]?.[1] ?? 0;
    const tiedUserIds = ranked.filter((entry) => entry[1] === highest).map((entry) => entry[0]);

    if (tiedUserIds.length !== 1) {
      const result: LiarResult = {
        winner: "liar",
        reason: "최다 득표자가 동률이라 라이어를 특정하지 못했습니다.",
        accusedUserId: null,
        guessedWord: null,
      };
      this.phase = "ended";
      this.accusedUserId = null;
      this.result = result;
      return {
        accusedUserId: null,
        tiedUserIds,
        phase: this.phase,
        result,
      };
    }

    const accusedUserId = tiedUserIds[0];
    this.accusedUserId = accusedUserId;

    if (accusedUserId === this.liarId) {
      this.phase = "guess";
      return {
        accusedUserId,
        tiedUserIds,
        phase: this.phase,
        result: null,
      };
    }

    const accused = this.getPlayer(accusedUserId);
    const result: LiarResult = {
      winner: "liar",
      reason: `${accused?.displayName ?? "지목된 플레이어"} 님이 지목되었지만 라이어가 아니었습니다.`,
      accusedUserId,
      guessedWord: null,
    };
    this.phase = "ended";
    this.result = result;
    return {
      accusedUserId,
      tiedUserIds,
      phase: this.phase,
      result,
    };
  }
}

export function phaseLabel(phase: LiarPhase): string {
  switch (phase) {
    case "lobby":
      return "로비";
    case "clue":
      return "설명";
    case "discussion":
      return "토론";
    case "voting":
      return "투표";
    case "guess":
      return "라이어 추리";
    case "ended":
      return "종료";
    default:
      return phase;
  }
}
