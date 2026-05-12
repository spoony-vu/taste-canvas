import { HttpError } from "./_errors.js";
import type { TasteItem } from "../src/lib/types.js";

const CATEGORY_RE = /^[a-z0-9-]{1,48}$/;
const MAX_TAGS = 40;
const MAX_TAG_LENGTH = 60;

export function normalizeCategory(value: unknown, fallback?: string): TasteItem["category"] {
  const category = typeof value === "string" ? value.trim() : "";
  if (!category && fallback) return fallback as TasteItem["category"];
  if (!CATEGORY_RE.test(category)) {
    throw new HttpError(400, "Invalid category", "invalid_category");
  }
  return category as TasteItem["category"];
}

export function normalizeTags(value: unknown): string[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new HttpError(400, "Invalid tags", "invalid_tags");
  }
  return value
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, MAX_TAGS)
    .map((tag) => tag.slice(0, MAX_TAG_LENGTH));
}

export function parseTagsJson(value: Buffer | undefined): string[] {
  if (!value) return [];
  try {
    return normalizeTags(JSON.parse(value.toString("utf-8")));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "Invalid tags JSON", "invalid_tags");
  }
}

export function normalizeItemPatch(value: unknown): Partial<TasteItem> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "Invalid patch", "invalid_patch");
  }

  const patch = value as Partial<TasteItem>;
  const normalized: Partial<TasteItem> = {};
  if ("category" in patch) normalized.category = normalizeCategory(patch.category);
  if ("tags" in patch) normalized.tags = normalizeTags(patch.tags);
  if (!("category" in normalized) && !("tags" in normalized)) {
    throw new HttpError(400, "Patch has no supported fields", "empty_patch");
  }
  return normalized;
}
