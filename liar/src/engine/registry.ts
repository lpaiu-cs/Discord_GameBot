import { LiarGame } from "./game";

export class InMemoryLiarGameRegistry {
  private readonly gamesByGuild = new Map<string, LiarGame>();

  get(guildId: string): LiarGame | null {
    return this.gamesByGuild.get(guildId) ?? null;
  }

  create(params: ConstructorParameters<typeof LiarGame>[0]): LiarGame {
    const game = new LiarGame(params);
    this.gamesByGuild.set(params.guildId, game);
    return game;
  }

  delete(guildId: string): void {
    this.gamesByGuild.delete(guildId);
  }
}
