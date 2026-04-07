import { AnimatePresence } from "framer-motion";
import { TasteCard } from "./TasteCard";
import type { TasteItem } from "../lib/types";

interface CardGridProps {
  items: TasteItem[];
  onDelete: (id: string) => void;
  onZoom: (item: TasteItem) => void;
}

export function CardGrid({ items, onDelete, onZoom }: CardGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <p
          className="text-[15px]"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          No items match your filters
        </p>
      </div>
    );
  }

  return (
    <div className="masonry">
      <AnimatePresence mode="popLayout">
        {items.map((item, i) => (
          <TasteCard
            key={item.id}
            item={item}
            index={i}
            onDelete={onDelete}
            onZoom={onZoom}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
