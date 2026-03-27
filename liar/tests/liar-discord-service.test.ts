import assert from "node:assert/strict";
import { test } from "node:test";
import { LiarDiscordService } from "../src/discord/service";
import { LiarGame } from "../src/engine/game";

function createFakeChannel() {
  const sent: Array<{ content: string; components?: any[] }> = [];
  const edited: Array<{ content: string; components?: any[] }> = [];
  return {
    sent,
    edited,
    isTextBased() {
      return true;
    },
    async send(payload: { content: string; components?: any[] }) {
      sent.push(payload);
      return { id: `message-${sent.length}` };
    },
    messages: {
      async fetch() {
        return {
          async edit(payload: { content: string; components?: any[] }) {
            edited.push(payload);
          },
        };
      },
    },
  };
}

function createServiceWithGame() {
  const service = new LiarDiscordService() as any;
  const game = service.registry.create({
    guildId: "guild-1",
    guildName: "테스트 길드",
    channelId: "channel-1",
    hostId: "host",
    hostDisplayName: "방장",
    categoryId: "food",
  }) as LiarGame;
  game.addPlayer("p1", "민준");
  game.addPlayer("p2", "서윤");
  game.addPlayer("p3", "하준");
  return { service: service as LiarDiscordService, game };
}

test("현재 차례 플레이어의 일반 메시지는 설명 제출로 처리된다", async () => {
  const { service, game } = createServiceWithGame();
  const channel = createFakeChannel();
  const client = { channels: { fetch: async () => channel } } as any;

  const rolls = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
  game.start(() => rolls.shift() ?? 0);
  const currentSpeaker = game.getCurrentSpeaker()!;

  const handled = await service.handleMessage(client, {
    author: { id: currentSpeaker.userId, bot: false, username: currentSpeaker.displayName },
    member: { displayName: currentSpeaker.displayName },
    channel,
    channelId: "channel-1",
    content: "첫 단서입니다",
    guildId: "guild-1",
    inGuild() {
      return true;
    },
    mentions: { users: { size: 0, first: () => null } },
  } as any);

  assert.equal(handled, true);
  assert.equal(game.clues.length, 1);
  assert.equal(game.clues[0].content, "첫 단서입니다");
  assert.ok(channel.sent.some((payload) => payload.content.includes("다음 차례")));
});

test("!투표 prefix 는 마지막 표에서 바로 집계까지 진행한다", async () => {
  const { service, game } = createServiceWithGame();
  const channel = createFakeChannel();
  const client = { channels: { fetch: async () => channel } } as any;

  const rolls = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
  game.start(() => rolls.shift() ?? 0);
  while (game.phase === "clue") {
    const speaker = game.getCurrentSpeaker()!;
    game.submitClue(speaker.userId, `${speaker.displayName} 설명`);
  }
  game.beginVote();
  game.submitVote("host", "host");
  game.submitVote("p1", "host");
  game.submitVote("p2", "host");

  const handled = await service.handleMessage(client, {
    author: { id: "p3", bot: false, username: "하준" },
    member: { displayName: "하준" },
    channel,
    channelId: "channel-1",
    content: "!투표 <@host>",
    guildId: "guild-1",
    inGuild() {
      return true;
    },
    mentions: {
      users: {
        size: 1,
        first: () => ({ id: "host", username: "방장" }),
      },
    },
  } as any);

  assert.equal(handled, true);
  assert.equal(game.phase, "guess");
  assert.equal(game.accusedUserId, "host");
  assert.ok(channel.sent.some((payload) => payload.content.includes("라이어로 지목되었습니다")));
});
