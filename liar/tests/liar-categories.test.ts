import assert from "node:assert/strict";
import { test } from "node:test";
import { getDefaultLiarCategory, getLiarCategories, getLiarCategory, hasGuildCategoryOverride } from "../src/content/categories";

test("길드 전용 확장 팩은 기본 카테고리에 새 항목을 추가한다", () => {
  const categories = getLiarCategories("example-extend-pack");

  assert.equal(hasGuildCategoryOverride("example-extend-pack"), true);
  assert.ok(categories.some((category) => category.id === "food"));
  assert.ok(categories.some((category) => category.id === "sports"));
  assert.equal(getLiarCategory("sports", "example-extend-pack")?.label, "스포츠");
});

test("길드 전용 교체 팩은 기본 카테고리 대신 자체 목록을 사용한다", () => {
  const categories = getLiarCategories("example-replace-pack");

  assert.equal(categories.length, 1);
  assert.equal(categories[0].id, "k-snack");
  assert.equal(getDefaultLiarCategory("example-replace-pack").id, "k-snack");
  assert.equal(getLiarCategory("food", "example-replace-pack"), null);
});
