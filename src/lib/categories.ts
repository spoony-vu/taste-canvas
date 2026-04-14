import type { Category } from "./types";

export interface CategoryDef {
  id: Category;
  label: string;
  color: string;
  dot: string;
}

export const categories: CategoryDef[] = [
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

const _map = Object.fromEntries(
  categories.map((c) => [c.id, c])
) as Record<string, CategoryDef>;

const fallback: CategoryDef = {
  id: "ui" as Category,
  label: "Unknown",
  color: "oklch(0.55 0.01 260)",
  dot: "oklch(0.45 0.01 260)",
};

/** Safe lookup — returns fallback for removed/unknown categories */
export const categoryMap = new Proxy(_map, {
  get: (target, prop: string) => target[prop] ?? fallback,
}) as Record<string, CategoryDef>;
