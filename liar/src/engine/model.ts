export type LiarPhase = "lobby" | "clue" | "discussion" | "voting" | "guess" | "ended";

export type LiarWinner = "citizens" | "liar";

export interface LiarPlayer {
  readonly userId: string;
  displayName: string;
  readonly joinedAt: number;
}

export interface LiarClue {
  readonly userId: string;
  readonly displayName: string;
  readonly content: string;
  readonly submittedAt: number;
  readonly order: number;
}

export interface LiarVote {
  readonly voterId: string;
  readonly targetId: string;
  readonly submittedAt: number;
}

export interface LiarResult {
  readonly winner: LiarWinner;
  readonly reason: string;
  readonly accusedUserId: string | null;
  readonly guessedWord: string | null;
}

export interface LiarKeywordView {
  readonly categoryLabel: string;
  readonly isLiar: boolean;
  readonly keyword: string | null;
  readonly message: string;
}

export interface LiarClueSubmissionResult {
  readonly phaseChanged: boolean;
  readonly nextSpeakerId: string | null;
}

export interface LiarVoteResolution {
  readonly accusedUserId: string | null;
  readonly tiedUserIds: readonly string[];
  readonly phase: LiarPhase;
  readonly result: LiarResult | null;
}
