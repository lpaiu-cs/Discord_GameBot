export type RecordedLiarMatchStatus = "completed" | "cancelled";
export type RecordedLiarWinner = "liar" | "citizens" | null;

export interface RecordedLiarMatchPlayer {
  discordUserId: string;
  displayName: string;
  joinedOrder: number;
  isHost: boolean;
  isLiar: boolean;
  wasAccused: boolean;
  isWinner: boolean;
  submittedClue: boolean;
  clueOrder: number | null;
  voteTargetUserId: string | null;
}

export interface RecordedLiarMatch {
  externalGameId: string;
  discordGuildId: string;
  guildName: string | null;
  categoryId: string;
  categoryLabel: string;
  secretWord: string | null;
  status: RecordedLiarMatchStatus;
  winner: RecordedLiarWinner;
  endedReason: string | null;
  guessedWord: string | null;
  accusedUserId: string | null;
  playerCount: number;
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date;
  players: RecordedLiarMatchPlayer[];
}
