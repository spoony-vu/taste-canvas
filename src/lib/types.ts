export type Category =
  | "typeface"
  | "symbol"
  | "landing-pages"
  | "interactions"
  | "patterns"
  | "branding"
  | "ui"
  | "graphics"
  | "tools";

export type LayoutMode = "masonry" | "grid" | "feed";

export interface TasteItem {
  id: string;
  title: string;
  url: string;
  image: string;
  thumb?: string;
  lqip?: string;
  video?: string;
  category: Category;
  tags: string[];
  added: string;
}

export interface Manifest {
  items: TasteItem[];
}

export interface TwitterBookmark {
  id: string;
  text: string;
  authorHandle: string;
  authorName: string;
  authorProfileImageUrl: string;
  postedAt: string;
  mediaObjects: {
    type: string;
    url: string;
    width: number;
    height: number;
  }[];
}
