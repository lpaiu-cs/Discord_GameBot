import {
  Channel,
  ChatInputCommandInteraction,
  Client,
  MessageFlags,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  TextBasedChannel,
} from "discord.js";
import { liarCommand, liarKeywordCommand } from "./commands";
import { InMemoryLiarGameRegistry } from "../engine/registry";
import { LiarGame } from "../engine/game";
import { LiarVoteResolution } from "../engine/model";

export class LiarDiscordService {
  private readonly registry = new InMemoryLiarGameRegistry();

  get commandDefinitions(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
    return [liarCommand.toJSON(), liarKeywordCommand.toJSON()];
  }

  async handleCommand(client: Client, interaction: ChatInputCommandInteraction): Promise<boolean> {
    if (interaction.commandName === liarKeywordCommand.name) {
      await this.handleKeywordCommand(interaction);
      return true;
    }

    if (interaction.commandName !== liarCommand.name) {
      return false;
    }

    if (!interaction.guildId || !interaction.guild) {
      throw new Error("서버 안에서만 사용할 수 있습니다.");
    }

    const subcommand = interaction.options.getSubcommand();
    let game = this.registry.get(interaction.guildId);

    switch (subcommand) {
      case "create": {
        if (game && game.phase !== "ended") {
          throw new Error("이 서버에는 이미 라이어게임이 진행 중입니다.");
        }

        if (game?.phase === "ended") {
          this.registry.delete(interaction.guildId);
        }

        const member = await interaction.guild.members.fetch(interaction.user.id);
        game = this.registry.create({
          guildId: interaction.guildId,
          guildName: interaction.guild.name,
          channelId: interaction.channelId,
          hostId: interaction.user.id,
          hostDisplayName: member.displayName,
          categoryId: interaction.options.getString("category") ?? undefined,
        });
        await this.replyEphemeral(interaction, "라이어게임 로비를 만들었습니다.");
        await this.syncStatusMessage(client, game, interaction.channel ?? null);
        return true;
      }
      case "join": {
        if (!game) {
          throw new Error("현재 진행 중인 라이어게임 로비가 없습니다.");
        }

        this.assertGameChannel(interaction, game);
        const member = await interaction.guild.members.fetch(interaction.user.id);
        game.addPlayer(interaction.user.id, member.displayName);
        await this.replyEphemeral(interaction, "라이어게임에 참가했습니다.");
        await this.syncStatusMessage(client, game, interaction.channel ?? null);
        return true;
      }
      case "leave": {
        if (!game) {
          throw new Error("현재 진행 중인 라이어게임이 없습니다.");
        }

        this.assertGameChannel(interaction, game);
        const previousHostId = game.hostId;
        game.removePlayer(interaction.user.id);
        await this.replyEphemeral(interaction, "라이어게임 로비에서 나갔습니다.");

        if (game.playerCount === 0) {
          this.registry.delete(interaction.guildId);
          await this.sendPublicMessage(client, game, "모든 참가자가 나가서 라이어게임 로비를 닫았습니다.");
          return true;
        }

        await this.syncStatusMessage(client, game, interaction.channel ?? null);
        if (previousHostId === interaction.user.id && game.hostId) {
          const newHost = game.getPlayer(game.hostId);
          await this.sendPublicMessage(client, game, `${newHost?.displayName ?? "다음 참가자"} 님이 새 방장이 되었습니다.`);
        }
        return true;
      }
      case "category": {
        if (!game) {
          throw new Error("현재 진행 중인 라이어게임이 없습니다.");
        }

        this.assertGameChannel(interaction, game);
        this.assertHost(interaction, game);
        const categoryId = interaction.options.getString("value", true);
        game.setCategory(categoryId);
        await this.replyEphemeral(interaction, `카테고리를 ${game.category.label} 로 바꿨습니다.`);
        await this.syncStatusMessage(client, game, interaction.channel ?? null);
        return true;
      }
      case "start": {
        if (!game) {
          throw new Error("현재 진행 중인 라이어게임 로비가 없습니다.");
        }

        this.assertGameChannel(interaction, game);
        this.assertHost(interaction, game);
        game.start();
        await this.replyEphemeral(interaction, "라이어게임을 시작했습니다. `/제시어` 로 개인 정보를 확인하세요.");
        await this.syncStatusMessage(client, game, interaction.channel ?? null);
        await this.sendPublicMessage(
          client,
          game,
          [
            `라이어게임이 시작되었습니다. 카테고리는 ${game.category.label} 입니다.`,
            "각 참가자는 `/제시어` 로 자기 정보를 확인하세요.",
            "설명 순서:",
            game.describeTurnOrder(),
            `첫 차례는 ${game.getCurrentSpeaker()?.displayName ?? "알 수 없음"} 님입니다.`,
          ].join("\n"),
        );
        return true;
      }
      case "clue": {
        if (!game) {
          throw new Error("현재 진행 중인 라이어게임이 없습니다.");
        }

        this.assertGameChannel(interaction, game);
        const content = interaction.options.getString("content", true);
        const speaker = game.getPlayer(interaction.user.id);
        const result = game.submitClue(interaction.user.id, content);
        await this.replyEphemeral(interaction, "설명을 제출했습니다.");
        await this.sendPublicMessage(client, game, `${game.clues.length}. ${speaker?.displayName ?? interaction.user.username}: ${game.clues.at(-1)?.content ?? content}`);

        if (result.phaseChanged) {
          await this.sendPublicMessage(
            client,
            game,
            "모든 참가자의 설명이 끝났습니다. 자유 토론을 진행한 뒤 방장이 `/liar begin-vote` 로 투표를 여세요.",
          );
        } else {
          const nextSpeaker = result.nextSpeakerId ? game.getPlayer(result.nextSpeakerId) : null;
          await this.sendPublicMessage(client, game, `다음 차례는 ${nextSpeaker?.displayName ?? "알 수 없음"} 님입니다.`);
        }

        await this.syncStatusMessage(client, game);
        return true;
      }
      case "begin-vote": {
        if (!game) {
          throw new Error("현재 진행 중인 라이어게임이 없습니다.");
        }

        this.assertGameChannel(interaction, game);
        this.assertHost(interaction, game);
        game.beginVote();
        await this.replyEphemeral(interaction, "투표를 시작했습니다.");
        await this.syncStatusMessage(client, game, interaction.channel ?? null);
        await this.sendPublicMessage(client, game, "투표를 시작합니다. 각 참가자는 `/liar vote` 로 의심되는 플레이어를 지목하세요.");
        return true;
      }
      case "vote": {
        if (!game) {
          throw new Error("현재 진행 중인 라이어게임이 없습니다.");
        }

        this.assertGameChannel(interaction, game);
        const target = interaction.options.getUser("target", true);
        const voteResult = game.submitVote(interaction.user.id, target.id);
        const targetPlayer = game.getPlayer(target.id);
        await this.replyEphemeral(interaction, `${targetPlayer?.displayName ?? target.username} 님에게 투표했습니다.`);
        await this.sendPublicMessage(client, game, `${game.getPlayer(interaction.user.id)?.displayName ?? interaction.user.username} 님이 투표를 마쳤습니다. (${voteResult.progress}/${game.playerCount})`);

        if (voteResult.completed && voteResult.resolution) {
          await this.announceVoteResolution(client, game, voteResult.resolution);
        }

        await this.syncStatusMessage(client, game);
        return true;
      }
      case "tally": {
        if (!game) {
          throw new Error("현재 진행 중인 라이어게임이 없습니다.");
        }

        this.assertGameChannel(interaction, game);
        this.assertHost(interaction, game);
        const resolution = game.tallyVotes();
        await this.replyEphemeral(interaction, "현재 투표를 집계했습니다.");
        await this.announceVoteResolution(client, game, resolution);
        await this.syncStatusMessage(client, game);
        return true;
      }
      case "guess": {
        if (!game) {
          throw new Error("현재 진행 중인 라이어게임이 없습니다.");
        }

        this.assertGameChannel(interaction, game);
        const guess = interaction.options.getString("word", true);
        const result = game.guessWord(interaction.user.id, guess);
        await this.replyEphemeral(interaction, "제시어 추리를 제출했습니다.");
        await this.syncStatusMessage(client, game, interaction.channel ?? null);
        await this.sendPublicMessage(client, game, this.buildResultAnnouncement(game, result));
        return true;
      }
      case "status": {
        if (!game) {
          throw new Error("현재 진행 중인 라이어게임이 없습니다.");
        }

        this.assertGameChannel(interaction, game);
        await this.replyEphemeral(interaction, "현재 라이어게임 상태를 다시 표시했습니다.");
        await this.syncStatusMessage(client, game, interaction.channel ?? null);
        return true;
      }
      case "end": {
        if (!game) {
          throw new Error("현재 진행 중인 라이어게임이 없습니다.");
        }

        this.assertGameChannel(interaction, game);
        this.assertHost(interaction, game);
        const result = game.forceEnd("방장이 라이어게임을 종료했습니다.");
        await this.replyEphemeral(interaction, "라이어게임을 종료했습니다.");
        await this.syncStatusMessage(client, game, interaction.channel ?? null);
        await this.sendPublicMessage(client, game, this.buildResultAnnouncement(game, result));
        return true;
      }
      default:
        throw new Error("지원하지 않는 라이어게임 명령입니다.");
    }
  }

  private async handleKeywordCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guildId) {
      throw new Error("서버 안에서만 사용할 수 있습니다.");
    }

    const game = this.registry.get(interaction.guildId);
    if (!game) {
      throw new Error("현재 진행 중인 라이어게임이 없습니다.");
    }

    const keywordView = game.getKeywordView(interaction.user.id);
    await this.replyEphemeral(interaction, keywordView.message);
  }

  private buildStatusMessage(game: LiarGame): string {
    const lines = ["라이어게임", game.describeStatus()];

    if (game.phase === "lobby") {
      lines.push("참가 명령: `/liar join`");
      lines.push("카테고리 변경: `/liar category`");
      lines.push("시작 명령: `/liar start`");
    }

    if (game.phase === "clue") {
      lines.push("현재 차례인 참가자가 `/liar clue` 로 한 문장을 제출하세요.");
    }

    if (game.phase === "discussion") {
      lines.push("자유 토론 후 방장이 `/liar begin-vote` 를 입력하세요.");
    }

    if (game.phase === "voting") {
      lines.push("각 참가자가 `/liar vote` 로 한 명을 지목하세요.");
      lines.push("필요하면 방장이 `/liar tally` 로 바로 집계할 수 있습니다.");
    }

    if (game.phase === "guess") {
      lines.push("지목된 라이어가 `/liar guess` 로 제시어를 추리해야 합니다.");
    }

    return lines.join("\n");
  }

  private buildResultAnnouncement(game: LiarGame, result: { winner: "citizens" | "liar"; reason: string }): string {
    const wordLine = game.secretWord ? `정답 제시어: ${game.secretWord}` : null;
    const liarLine = game.liarId ? `라이어: ${game.getPlayer(game.liarId)?.displayName ?? game.liarId}` : null;
    return [result.winner === "citizens" ? "시민팀 승리" : "라이어 승리", result.reason, wordLine, liarLine]
      .filter((line): line is string => Boolean(line))
      .join("\n");
  }

  private async announceVoteResolution(client: Client, game: LiarGame, resolution: LiarVoteResolution): Promise<void> {
    if (resolution.tiedUserIds.length > 1 || !resolution.accusedUserId) {
      if (resolution.result) {
        await this.sendPublicMessage(client, game, this.buildResultAnnouncement(game, resolution.result));
      }
      return;
    }

    const accused = game.getPlayer(resolution.accusedUserId);
    if (resolution.phase === "guess") {
      await this.sendPublicMessage(
        client,
        game,
        `${accused?.displayName ?? "지목된 플레이어"} 님이 라이어로 지목되었습니다. 이제 해당 플레이어는 \`/liar guess\` 로 제시어를 추리하세요.`,
      );
      return;
    }

    if (resolution.result) {
      await this.sendPublicMessage(client, game, this.buildResultAnnouncement(game, resolution.result));
    }
  }

  private async replyEphemeral(interaction: ChatInputCommandInteraction, content: string): Promise<void> {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }

  private assertHost(interaction: ChatInputCommandInteraction, game: LiarGame): void {
    if (interaction.user.id !== game.hostId) {
      throw new Error("방장만 사용할 수 있는 명령입니다.");
    }
  }

  private assertGameChannel(interaction: ChatInputCommandInteraction, game: LiarGame): void {
    if (interaction.channelId !== game.channelId) {
      throw new Error("이 게임은 생성된 채널에서만 관리할 수 있습니다.");
    }
  }

  private async syncStatusMessage(client: Client, game: LiarGame, preferredChannel: Channel | null = null): Promise<void> {
    const channel = await this.resolveTextChannel(client, game.channelId, preferredChannel);
    const payload = { content: this.buildStatusMessage(game) };

    if (!game.statusMessageId) {
      const message = await channel.send(payload);
      game.statusMessageId = message.id;
      return;
    }

    try {
      if (!("messages" in channel)) {
        throw new Error("메시지 매니저를 찾을 수 없습니다.");
      }

      const existing = await channel.messages.fetch(game.statusMessageId);
      await existing.edit(payload);
    } catch {
      const message = await channel.send(payload);
      game.statusMessageId = message.id;
    }
  }

  private async sendPublicMessage(client: Client, game: LiarGame, content: string): Promise<void> {
    const channel = await this.resolveTextChannel(client, game.channelId);
    await channel.send({ content });
  }

  private async resolveTextChannel(
    client: Client,
    channelId: string,
    preferredChannel: Channel | null = null,
  ): Promise<TextBasedChannel & { messages: any; send: (payload: { content: string }) => Promise<{ id: string }> }> {
    const candidate = preferredChannel ?? (await client.channels.fetch(channelId));
    if (!candidate || !candidate.isTextBased()) {
      throw new Error("텍스트 채널을 찾을 수 없습니다.");
    }

    return candidate as TextBasedChannel & { messages: any; send: (payload: { content: string }) => Promise<{ id: string }> };
  }
}
