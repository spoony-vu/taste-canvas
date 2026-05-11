// `string & {}` keeps autocomplete for the built-in literals while still
// allowing user-defined custom category ids at runtime.
export type Category =
  | "typeface"
  | "symbol"
  | "landing-pages"
  | "interactions"
  | "patterns"
  | "branding"
  | "ui"
  | "graphics"
  | "tools"
  | (string & {});

export type LayoutMode = "masonry" | "grid" | "feed";

export interface TasteItem {
  id: string;
  title: string;
  url: string;
  image: string;
  thumb?: string;
  lqip?: string;
  video?: string;
  width?: number;
  height?: number;
  category: Category;
  tags: string[];
  added: string;
}

export interface Manifest {
  items: TasteItem[];
}
