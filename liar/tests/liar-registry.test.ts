import assert from "node:assert/strict";
import { test } from "node:test";
import { getLiarCategory } from "../src/content/categories";
import { InMemoryLiarGameRegistry } from "../src/engine/registry";

test("같은 길드 카테고리는 한 사이클이 끝날 때까지 최근 제시어를 제외한다", () => {
  const registry = new InMemoryLiarGameRegistry();
  const category = getLiarCategory("food");
  assert.ok(category);

  for (const word of category.words) {
    registry.recordUsedWord("guild-1", category.id, word, category.words);
  }

  assert.deepEqual(registry.getRecentWords("guild-1", category.id, category.words), []);

  registry.recordUsedWord("guild-1", category.id, category.words[0], category.words);

  assert.deepEqual(registry.getRecentWords("guild-1", category.id, category.words), [category.words[0]]);
});
