import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface LiarCategory {
  readonly id: string;
  readonly label: string;
  readonly words: readonly string[];
}

type LiarGuildCategoryMode = "extend" | "replace";

interface LiarGuildCategoryOverride {
  readonly mode: LiarGuildCategoryMode;
  readonly categories: readonly LiarCategory[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readJsonResource(paths: readonly string[], required: boolean): { path: string; value: unknown } | null {
  const resourcePath = paths.find((candidate) => existsSync(candidate));
  if (!resourcePath) {
    if (required) {
      throw new Error(paths[0] ?? "라이어게임 리소스 파일을 찾을 수 없습니다.");
    }

    return null;
  }

  return {
    path: resourcePath,
    value: JSON.parse(readFileSync(resourcePath, "utf8")) as unknown,
  };
}

function parseCategories(raw: unknown, sourceLabel: string): readonly LiarCategory[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`${sourceLabel} 는 비어 있지 않은 배열이어야 합니다.`);
  }

  const seenIds = new Set<string>();
  return Object.freeze(
    raw.map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        throw new Error(`${sourceLabel} ${index + 1}번 항목 형식이 올바르지 않습니다.`);
      }

      const { id, label, words } = entry as {
        id?: unknown;
        label?: unknown;
        words?: unknown;
      };

      if (!isNonEmptyString(id) || !isNonEmptyString(label)) {
        throw new Error(`${sourceLabel} ${index + 1}번 항목의 id 또는 label 이 비어 있습니다.`);
      }

      const normalizedId = id.trim();
      if (seenIds.has(normalizedId)) {
        throw new Error(`${sourceLabel} 에 중복 카테고리 id ${normalizedId} 이(가) 있습니다.`);
      }
      seenIds.add(normalizedId);

      if (!Array.isArray(words) || words.length === 0 || words.some((word) => !isNonEmptyString(word))) {
        throw new Error(`${sourceLabel} ${normalizedId} 의 words 는 비어 있지 않은 문자열 배열이어야 합니다.`);
      }

      const normalizedWords = [...new Set(words.map((word) => word.trim()))];
      return Object.freeze({
        id: normalizedId,
        label: label.trim(),
        words: Object.freeze(normalizedWords),
      });
    }),
  );
}

function loadCategoryResource(): readonly LiarCategory[] {
  const resource = readJsonResource(
    [
      resolve(__dirname, "../../resource/categories.json"),
      resolve(process.cwd(), "liar/resource/categories.json"),
    ],
    true,
  );

  return parseCategories(resource?.value, "라이어게임 카테고리 리소스");
}

function loadGuildCategoryOverrides(): ReadonlyMap<string, LiarGuildCategoryOverride> {
  const resource = readJsonResource(
    [
      resolve(__dirname, "../../resource/guild-categories.json"),
      resolve(process.cwd(), "liar/resource/guild-categories.json"),
    ],
    false,
  );

  if (!resource) {
    return new Map();
  }

  const raw = resource.value as { guilds?: unknown };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("liar/resource/guild-categories.json 형식이 올바르지 않습니다.");
  }

  const guilds = raw.guilds;
  if (!guilds || typeof guilds !== "object" || Array.isArray(guilds)) {
    throw new Error("liar/resource/guild-categories.json 의 guilds 는 객체여야 합니다.");
  }

  const overrides = new Map<string, LiarGuildCategoryOverride>();
  for (const [guildId, entry] of Object.entries(guilds)) {
    if (!isNonEmptyString(guildId)) {
      throw new Error("guild-categories 의 guild id 는 비어 있을 수 없습니다.");
    }

    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`길드 ${guildId} 의 카테고리 팩 형식이 올바르지 않습니다.`);
    }

    const { mode, categories } = entry as { mode?: unknown; categories?: unknown };
    const resolvedMode: LiarGuildCategoryMode = mode === "replace" ? "replace" : "extend";
    const parsedCategories = parseCategories(categories, `길드 ${guildId} 카테고리 팩`);
    overrides.set(guildId, Object.freeze({ mode: resolvedMode, categories: parsedCategories }));
  }

  return overrides;
}

function mergeCategories(base: readonly LiarCategory[], override: readonly LiarCategory[]): readonly LiarCategory[] {
  const merged = [...base];
  for (const category of override) {
    const index = merged.findIndex((entry) => entry.id === category.id);
    if (index === -1) {
      merged.push(category);
      continue;
    }

    merged[index] = category;
  }

  return Object.freeze(merged);
}

export const liarCategories: readonly LiarCategory[] = loadCategoryResource();

const liarGuildCategoryOverrides = loadGuildCategoryOverrides();
const liarGuildCategoryCache = new Map<string, readonly LiarCategory[]>();

export function getLiarCategories(guildId?: string): readonly LiarCategory[] {
  if (!guildId) {
    return liarCategories;
  }

  const cached = liarGuildCategoryCache.get(guildId);
  if (cached) {
    return cached;
  }

  const override = liarGuildCategoryOverrides.get(guildId);
  if (!override) {
    return liarCategories;
  }

  const resolved = override.mode === "replace" ? override.categories : mergeCategories(liarCategories, override.categories);
  liarGuildCategoryCache.set(guildId, resolved);
  return resolved;
}

export function getLiarCategory(categoryId: string, guildId?: string): LiarCategory | null {
  return getLiarCategories(guildId).find((category) => category.id === categoryId) ?? null;
}

export function getDefaultLiarCategory(guildId?: string): LiarCategory {
  const categories = getLiarCategories(guildId);
  if (categories.length === 0) {
    throw new Error("사용 가능한 라이어게임 카테고리가 없습니다.");
  }

  return categories[0];
}

export function hasGuildCategoryOverride(guildId: string): boolean {
  return liarGuildCategoryOverrides.has(guildId);
}
