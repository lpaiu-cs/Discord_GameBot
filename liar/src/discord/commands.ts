import { SlashCommandBuilder } from "discord.js";

export const LIAR_CREATE_SUBCOMMAND = "create";
export const LIAR_STATS_SUBCOMMAND = "stats";

export const liarCommand = new SlashCommandBuilder()
  .setName("liar")
  .setDescription("라이어게임을 관리합니다.")
  .addSubcommand((subcommand) =>
    subcommand
      .setName(LIAR_CREATE_SUBCOMMAND)
      .setDescription("현재 서버에 라이어게임 로비를 생성합니다."),
  )
  .addSubcommand((subcommand) =>
    subcommand
      .setName(LIAR_STATS_SUBCOMMAND)
      .setDescription("저장된 라이어게임 전적을 확인합니다.")
      .addUserOption((option) => option.setName("target").setDescription("전적을 확인할 유저")),
  );

export const liarKeywordCommand = new SlashCommandBuilder()
  .setName("제시어")
  .setDescription("현재 참가 중인 라이어게임의 개인 제시어 정보를 확인합니다.");
