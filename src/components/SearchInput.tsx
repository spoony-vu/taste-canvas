import { useRef, useEffect } from "react";

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
}

export function SearchInput({ value, onChange }: SearchInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes(
          (e.target as HTMLElement).tagName
        )
      ) {
        e.preventDefault();
        ref.current?.focus();
      }
      if (e.key === "Escape") {
        onChange("");
        ref.current?.blur();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onChange]);

  return (
    <div className="relative">
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search..."
        className="h-9 w-48 rounded-lg border-none px-3 text-[13px] outline-none transition-all duration-200 placeholder:text-text-tertiary focus:w-64"
        style={{
          background: "var(--color-surface-1)",
          color: "var(--color-text-primary)",
        }}
      />
      {!value && (
        <kbd
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[10px]"
          style={{
            background: "var(--color-surface-2)",
            color: "var(--color-text-tertiary)",
          }}
        >
          /
        </kbd>
      )}
    </div>
  );
}
