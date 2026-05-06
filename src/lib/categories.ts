import { useEffect, useSyncExternalStore } from "react";
import type { Category } from "./types";

export interface CategoryDef {
  id: Category;
  label: string;
  color: string;
  dot: string;
}

const builtInCategories: CategoryDef[] = [
  {
    id: "typeface",
    label: "Typeface",
    color: "oklch(0.75 0.15 30)",
    dot: "oklch(0.65 0.2 30)",
  },
  {
    id: "symbol",
    label: "Symbol",
    color: "oklch(0.75 0.15 60)",
    dot: "oklch(0.65 0.2 60)",
  },
  {
    id: "landing-pages",
    label: "Landing Pages",
    color: "oklch(0.75 0.15 145)",
    dot: "oklch(0.65 0.2 145)",
  },
  {
    id: "interactions",
    label: "Interactions",
    color: "oklch(0.75 0.15 200)",
    dot: "oklch(0.65 0.2 200)",
  },
{
    id: "patterns",
    label: "Patterns",
    color: "oklch(0.75 0.15 320)",
    dot: "oklch(0.65 0.2 320)",
  },
  {
    id: "branding",
    label: "Branding",
    color: "oklch(0.75 0.15 100)",
    dot: "oklch(0.65 0.2 100)",
  },
  {
    id: "ui",
    label: "UI",
    color: "oklch(0.75 0.15 240)",
    dot: "oklch(0.65 0.2 240)",
  },
  {
    id: "graphics",
    label: "Graphics",
    color: "oklch(0.75 0.15 170)",
    dot: "oklch(0.65 0.2 170)",
  },
  {
    id: "tools",
    label: "Tools",
    color: "oklch(0.75 0.15 350)",
    dot: "oklch(0.65 0.2 350)",
  },
];

// ----- Custom categories (localStorage-backed runtime store) -----

const STORAGE_KEY = "taste-canvas:custom-categories";

function loadCustom(): CategoryDef[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (c): c is CategoryDef =>
        c && typeof c.id === "string" && typeof c.label === "string"
    );
  } catch {
    return [];
  }
}

function saveCustom(list: CategoryDef[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // quota exceeded / private mode — accept loss
  }
}

let customCategories: CategoryDef[] = loadCustom();
const subscribers = new Set<() => void>();

function notify() {
  subscribers.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

function getSnapshot(): CategoryDef[] {
  return cachedCombined;
}

let cachedCombined: CategoryDef[] = [...builtInCategories, ...customCategories];

function recompute() {
  cachedCombined = [...builtInCategories, ...customCategories];
}

/** Slugify a label into a stable id. Keeps lowercase ascii + hyphens. */
function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

/** Deterministic hue from a string so the same label always maps to the
 *  same color. djb2 hash, mod 360 — gives 360 distinct hues. */
function hueFromString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return Math.abs(h) % 360;
}

/**
 * Add a custom category. Returns the new def, or null if the label is
 * empty / collides with an existing id.
 */
export function addCustomCategory(label: string): CategoryDef | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  const id = slugify(trimmed);
  if (!id) return null;
  if (cachedCombined.some((c) => c.id === id)) return null;
  const hue = hueFromString(id);
  const def: CategoryDef = {
    id,
    label: trimmed,
    color: `oklch(0.75 0.15 ${hue})`,
    dot: `oklch(0.65 0.2 ${hue})`,
  };
  customCategories = [...customCategories, def];
  saveCustom(customCategories);
  recompute();
  notify();
  return def;
}

/** Remove a custom category by id. Built-ins cannot be removed. */
export function removeCustomCategory(id: string): boolean {
  const before = customCategories.length;
  customCategories = customCategories.filter((c) => c.id !== id);
  if (customCategories.length === before) return false;
  saveCustom(customCategories);
  recompute();
  notify();
  return true;
}

/**
 * React hook — returns the combined list (built-in + custom) and
 * re-renders on add/remove. Cross-tab sync via storage event below.
 */
export function useCategories(): CategoryDef[] {
  const list = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  // Cross-tab: another tab edits localStorage → reload + notify here.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      customCategories = loadCustom();
      recompute();
      notify();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return list;
}

/** Static accessor for non-React callers (legacy). */
export const categories: CategoryDef[] = new Proxy([] as CategoryDef[], {
  get(_t, prop) {
    return Reflect.get(cachedCombined, prop, cachedCombined);
  },
  has(_t, prop) {
    return prop in cachedCombined;
  },
  ownKeys() {
    return Reflect.ownKeys(cachedCombined);
  },
  getOwnPropertyDescriptor(_t, prop) {
    return Object.getOwnPropertyDescriptor(cachedCombined, prop);
  },
});

const fallback: CategoryDef = {
  id: "ui" as Category,
  label: "Unknown",
  color: "oklch(0.55 0.01 260)",
  dot: "oklch(0.45 0.01 260)",
};

/** Safe lookup — returns fallback for removed/unknown categories.
 *  Reads from the live combined list so newly-added custom categories
 *  resolve immediately. */
export const categoryMap = new Proxy({} as Record<string, CategoryDef>, {
  get: (_t, prop: string) =>
    cachedCombined.find((c) => c.id === prop) ?? fallback,
}) as Record<string, CategoryDef>;
