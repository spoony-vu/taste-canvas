export type Category =
  | "typeface"
  | "symbol"
  | "landing-pages"
  | "interactions"
  | "color-palette"
  | "patterns"
  | "branding"
  | "ui";

export interface TasteItem {
  id: string;
  title: string;
  url: string;
  image: string;
  thumb?: string;
  lqip?: string;
  category: Category;
  tags: string[];
  added: string;
}

export interface Manifest {
  items: TasteItem[];
}
