import { LiarGame } from "./game";

export class InMemoryLiarGameRegistry {
  private readonly gamesByGuild = new Map<string, LiarGame>();
  private readonly recentWordsByGuild = new Map<string, Map<string, string[]>>();

  get(guildId: string): LiarGame | null {
    return this.gamesByGuild.get(guildId) ?? null;
  }

  create(params: ConstructorParameters<typeof LiarGame>[0]): LiarGame {
    const game = new LiarGame(params);
    this.gamesByGuild.set(params.guildId, game);
    return game;
  }

  getRecentWords(guildId: string, categoryId: string, allWords: readonly string[]): readonly string[] {
    const categoryHistory = this.recentWordsByGuild.get(guildId)?.get(categoryId) ?? [];
    if (categoryHistory.length >= allWords.length) {
      return [];
    }

    return [...categoryHistory];
  }

  recordUsedWord(guildId: string, categoryId: string, word: string, allWords: readonly string[]): void {
    let guildHistory = this.recentWordsByGuild.get(guildId);
    if (!guildHistory) {
      guildHistory = new Map<string, string[]>();
      this.recentWordsByGuild.set(guildId, guildHistory);
    }

    const currentHistory = guildHistory.get(categoryId) ?? [];
    const nextHistory =
      currentHistory.length >= allWords.length ? [word] : [...currentHistory.filter((entry) => entry !== word), word];
    guildHistory.set(categoryId, nextHistory);
  }

  delete(guildId: string): void {
    this.gamesByGuild.delete(guildId);
  }
}
