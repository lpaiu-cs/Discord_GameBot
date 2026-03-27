import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Guild, GuildMember } from "discord.js";
import { PersistentGameRegistry } from "../src/game/persistent-registry";
import { PersistentJoinTicketStore } from "../src/web/persistent-join-ticket-store";
import { JoinTicketService } from "../src/web/join-ticket";
import { PersistentSessionStore } from "../src/web/persistent-session-store";

function createMember(id: string, displayName: string): GuildMember {
  return {
    id,
    displayName,
    user: { bot: false },
  } as GuildMember;
}

test("persistent session store 는 재시작 뒤에도 최근 세션을 복구한다", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "session-store-"));
  const filePath = path.join(dir, "sessions.json");

  const store = new PersistentSessionStore("session-secret", filePath);
  const session = store.create("game-1", "user-1");
  await store.flush();

  const reloaded = new PersistentSessionStore("session-secret", filePath);
  assert.equal(reloaded.get(session.id)?.discordUserId, "user-1");
});

test("persistent join ticket store 는 사용된 ticket 을 재시작 뒤에도 막는다", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "join-ticket-store-"));
  const filePath = path.join(dir, "tickets.json");

  const firstStore = new PersistentJoinTicketStore(filePath);
  const firstService = new JoinTicketService("join-secret", firstStore);
  const ticket = firstService.issue({
    gameId: "game-1",
    discordUserId: "user-1",
    ttlMs: 180_000,
  });

  await firstService.consume(ticket);
  await firstStore.flush();

  const secondService = new JoinTicketService("join-secret", new PersistentJoinTicketStore(filePath));
  await assert.rejects(async () => {
    await secondService.consume(ticket);
  }, /이미 사용된 join ticket/);
});

test("persistent game registry 는 게임 상태를 파일에 저장하고 다시 읽는다", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "game-registry-"));
  const filePath = path.join(dir, "games.json");

  const registry = new PersistentGameRegistry({
    filePath,
    deliveryMode: "web",
  });
  const guild = { id: "guild-1" } as Guild;
  const host = createMember("user-1", "host");
  const game = registry.create(guild, "channel-1", host, "balance");
  game.phase = "discussion";
  game.phaseContext = {
    token: 1,
    startedAt: Date.now(),
    deadlineAt: Date.now() + 60_000,
  };
  game.appendPublicLine("persistent state");
  await registry.flush();

  const reloaded = new PersistentGameRegistry({
    filePath,
    deliveryMode: "web",
  });
  const restoredGame = reloaded.findByGameId(game.id);

  assert.ok(restoredGame);
  assert.equal(restoredGame?.phase, "discussion");
  assert.equal(restoredGame?.phaseContext?.token, 1);
  assert.equal(restoredGame?.lastPublicLines.at(-1), "persistent state");
});
