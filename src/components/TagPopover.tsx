import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TagPopoverProps {
  tags: string[];
  onUpdate: (tags: string[]) => void;
  /** Render prop — receives onClick handler + open state */
  children: (props: { onClick: (e: React.MouseEvent) => void; isOpen: boolean }) => React.ReactNode;
}

export function TagPopover({ tags, onUpdate, children }: TagPopoverProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setInput("");
  }, []);

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setOpen((o) => !o);
    setInput("");
  }, []);

  useEffect(() => {
    if (!open) return;
    // Focus input after animation settles
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    }
    window.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey, true);
    };
  }, [open, close]);

  const addTag = useCallback(() => {
    const tag = input.trim().toLowerCase();
    if (!tag) return;
    if (!tags.includes(tag)) {
      onUpdate([...tags, tag]);
    }
    setInput("");
  }, [input, tags, onUpdate]);

  const removeTag = useCallback((tag: string) => {
    onUpdate(tags.filter((t) => t !== tag));
  }, [tags, onUpdate]);

  return (
    <div ref={containerRef} className="relative">
      {children({ onClick: toggle, isOpen: open })}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-full right-0 z-50 mb-2 w-56 rounded-xl p-2.5"
            style={{
              background: "var(--color-surface-2)",
              boxShadow: "0 12px 32px oklch(0 0 0 / 0.5), 0 0 0 0.5px var(--color-border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {tags.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{
                      background: "var(--color-surface-3)",
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {tag}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                      className="opacity-50 transition-opacity duration-100 hover:opacity-100"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
                if (e.key === "Backspace" && !input && tags.length) {
                  removeTag(tags[tags.length - 1]);
                }
              }}
              placeholder="Add tag..."
              className="h-7 w-full rounded-md border-none px-2 text-[12px] outline-none"
              style={{
                background: "var(--color-surface-0)",
                color: "var(--color-text-primary)",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
