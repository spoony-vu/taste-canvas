import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface UndoToastProps {
  title: string | null;
  onUndo: () => void;
  onExpire: () => void;
}

export function UndoToast({ title, onUndo, onExpire }: UndoToastProps) {
  useEffect(() => {
    if (!title) return;
    const timer = setTimeout(onExpire, 5000);
    return () => clearTimeout(timer);
  }, [title, onExpire]);

  return (
    <AnimatePresence>
      {title && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full px-4 py-2.5"
          style={{
            background: "var(--color-surface-2)",
            boxShadow: "0 8px 32px oklch(0 0 0 / 0.4)",
          }}
        >
          <span
            className="text-[13px] font-medium"
            style={{ color: "var(--color-text-primary)" }}
          >
            {`Removed\u00A0${title}`}
          </span>
          <button
            onClick={onUndo}
            className="rounded-full px-3 py-1 text-[12px] font-semibold transition-colors duration-150"
            style={{
              background: "var(--color-surface-3)",
              color: "var(--color-text-primary)",
            }}
          >
            Undo
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
