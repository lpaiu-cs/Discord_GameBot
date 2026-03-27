import { MafiaGame } from "../game/game";
import { LiarPlayerStats } from "./liar-player-stats";
import { RecordedLiarMatch } from "./liar-types";
import { PlayerDashboardStats } from "./player-dashboard-stats";
import { EnsureUserProfileInput, UserProfile } from "./user-profile";

export interface GameStatsStore {
  readonly enabled: boolean;
  initialize(): Promise<void>;
  ensureUserProfile(profile: EnsureUserProfileInput): Promise<void>;
  getUserProfile(discordUserId: string): Promise<UserProfile | null>;
  recordEndedGame(game: MafiaGame): Promise<void>;
  recordEndedLiarGame(record: RecordedLiarMatch): Promise<void>;
  getPlayerDashboardStats(discordUserId: string): Promise<PlayerDashboardStats | null>;
  getLiarPlayerStats(discordUserId: string): Promise<LiarPlayerStats | null>;
  close(): Promise<void>;
}

export class NoopGameStatsStore implements GameStatsStore {
  readonly enabled = false;

  async initialize(): Promise<void> {
    return;
  }

  async ensureUserProfile(_profile: EnsureUserProfileInput): Promise<void> {
    return;
  }

  async getUserProfile(_discordUserId: string): Promise<UserProfile | null> {
    return null;
  }

  async recordEndedGame(_game: MafiaGame): Promise<void> {
    return;
  }

  async recordEndedLiarGame(_record: RecordedLiarMatch): Promise<void> {
    return;
  }

  async getPlayerDashboardStats(_discordUserId: string): Promise<PlayerDashboardStats | null> {
    return null;
  }

  async getLiarPlayerStats(_discordUserId: string): Promise<LiarPlayerStats | null> {
    return null;
  }

  async close(): Promise<void> {
    return;
  }
}
