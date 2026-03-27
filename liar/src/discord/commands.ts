import { SlashCommandBuilder } from "discord.js";

export const liarCreateCommand = new SlashCommandBuilder()
  .setName("liar-create")
  .setDescription("현재 서버에 라이어게임 로비를 생성합니다.");

export const liarKeywordCommand = new SlashCommandBuilder()
  .setName("제시어")
  .setDescription("현재 참가 중인 라이어게임의 개인 제시어 정보를 확인합니다.");
