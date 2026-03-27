import { REST, Routes, SlashCommandBuilder, RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord.js";
import { config } from "../config";

export const mafiaCommand = new SlashCommandBuilder()
  .setName("mafia")
  .setDescription("마피아42 시즌4 게임을 관리합니다.")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("create")
      .setDescription("현재 채널에 새 시즌4 밸런스 게임 로비를 만듭니다.")
      // .addStringOption((option) =>
      //   option
      //     .setName("ruleset")
      //     .setDescription("시즌4 세부 규칙셋")
      //     .addChoices(
      //       { name: "시즌4 밸런스", value: "balance" },
      //       { name: "시즌4 초기", value: "initial" },
      //     ),
      // ),
  )
  .addSubcommand((subcommand) => subcommand.setName("dashboard").setDescription("현재 참가 중인 게임의 웹 대시보드 링크를 발급합니다."));

export async function registerCommands(commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [mafiaCommand.toJSON()]): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(config.token);
  const body = commands;

  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.applicationId, config.guildId), { body });
    return;
  }

  await rest.put(Routes.applicationCommands(config.applicationId), { body });
}
