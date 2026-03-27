import { SlashCommandBuilder } from "discord.js";
import { liarCategories } from "../content/categories";

export const liarCommand = new SlashCommandBuilder()
  .setName("liar")
  .setDescription("Discord 채팅 기반 라이어게임을 관리합니다.")
  .addSubcommand((subcommand) =>
    subcommand
      .setName("create")
      .setDescription("현재 채널에 라이어게임 로비를 만듭니다.")
      .addStringOption((option) =>
        option
          .setName("category")
          .setDescription("시작할 카테고리")
          .addChoices(...liarCategories.map((category) => ({ name: category.label, value: category.id }))),
      ),
  )
  .addSubcommand((subcommand) => subcommand.setName("join").setDescription("현재 라이어게임 로비에 참가합니다."))
  .addSubcommand((subcommand) => subcommand.setName("leave").setDescription("현재 라이어게임 로비에서 나갑니다."))
  .addSubcommand((subcommand) =>
    subcommand
      .setName("category")
      .setDescription("현재 라이어게임 로비의 카테고리를 바꿉니다.")
      .addStringOption((option) =>
        option
          .setName("value")
          .setDescription("새 카테고리")
          .setRequired(true)
          .addChoices(...liarCategories.map((category) => ({ name: category.label, value: category.id }))),
      ),
  )
  .addSubcommand((subcommand) => subcommand.setName("start").setDescription("현재 라이어게임을 시작합니다."))
  .addSubcommand((subcommand) =>
    subcommand
      .setName("clue")
      .setDescription("자기 차례에 제시어 설명 한 문장을 제출합니다.")
      .addStringOption((option) =>
        option.setName("content").setDescription("설명 문장").setRequired(true),
      ),
  )
  .addSubcommand((subcommand) => subcommand.setName("begin-vote").setDescription("토론을 마치고 투표를 시작합니다."))
  .addSubcommand((subcommand) =>
    subcommand
      .setName("vote")
      .setDescription("의심되는 플레이어에게 투표합니다.")
      .addUserOption((option) => option.setName("target").setDescription("지목할 플레이어").setRequired(true)),
  )
  .addSubcommand((subcommand) => subcommand.setName("tally").setDescription("현재 제출된 투표를 바로 집계합니다."))
  .addSubcommand((subcommand) =>
    subcommand
      .setName("guess")
      .setDescription("라이어가 제시어를 추리합니다.")
      .addStringOption((option) =>
        option.setName("word").setDescription("추리할 제시어").setRequired(true),
      ),
  )
  .addSubcommand((subcommand) => subcommand.setName("status").setDescription("현재 라이어게임 상태를 다시 표시합니다."))
  .addSubcommand((subcommand) => subcommand.setName("end").setDescription("현재 라이어게임을 종료합니다."));

export const liarKeywordCommand = new SlashCommandBuilder()
  .setName("제시어")
  .setDescription("현재 참가 중인 라이어게임의 개인 제시어 정보를 확인합니다.");
