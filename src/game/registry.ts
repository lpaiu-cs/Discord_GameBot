import { ChatInputCommandInteraction, Guild, GuildMember } from "discord.js";
import { config } from "process";
import { MafiaGame } from "./game";
import { Ruleset } from "./model";

export interface GameRegistry {
    onGameStateChange?: (gameId: string) => void;
    get(guildId: string): MafiaGame | undefined;
    findByGameId(gameId: string): MafiaGame | undefined;
    create(guild: Guild, channelId: string, host: GuildMember, ruleset: Ruleset): MafiaGame;
    delete(guildId: string): void;
}

export class InMemoryGameRegistry implements GameRegistry {
    private readonly games = new Map<string, MafiaGame>();
    public onGameStateChange: (gameId: string) => void;

    get(guildId: string): MafiaGame | undefined {
        return this.games.get(guildId);
    }

    findByGameId(gameId: string): MafiaGame | undefined {
        return [...this.games.values()].find((game) => game.id === gameId);
    }

    create(guild: Guild, channelId: string, host: GuildMember, ruleset: Ruleset): MafiaGame {
        const existing = this.games.get(guild.id);
        if (existing && existing.phase !== "ended") {
          throw new Error("이 서버에는 이미 진행 중인 마피아 게임이 있습니다.");
        }

        let game!: MafiaGame;
        game = new MafiaGame(
          guild,
          channelId,
          host,
          ruleset,
          (guildId) => {
            const endedGame = this.games.get(guildId);
            if (endedGame) {
              this.onEnded?.(endedGame);
            }
          },
          config.gameDeliveryMode,
          (g) => this.onGameStateChange?.(g.id),
        );
        this.games.set(guild.id, game);
        return game;
    }

    delete(guildId: string): void {
        this.games.delete(guildId);
    }
}

export function createGame(manager: GameRegistry, interaction: ChatInputCommandInteraction, ruleset: Ruleset): MafiaGame {
    const guild = interaction.guild;
    const member = interaction.member as GuildMember | null;
    if (!guild || !member || !interaction.channelId) {
    throw new Error("서버 텍스트 채널에서만 게임을 만들 수 있습니다.");
    }

    return manager.create(guild, interaction.channelId, member, ruleset);
}
