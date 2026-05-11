interface VideoPlayBadgeProps {
  size?: "sm" | "md";
}

export function ImageUnavailableIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" opacity="0.55">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 15l5-4 4 3 4-5 5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="9" r="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function ImageUnavailableOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      style={{
        background: "var(--color-surface-2)",
        color: "var(--color-text-tertiary)",
      }}
      aria-hidden="true"
    >
      <ImageUnavailableIcon />
    </div>
  );
}

export function LightboxUnavailablePreview() {
  return (
    <div
      className="flex h-full min-h-[260px] w-full items-center justify-center rounded-xl"
      style={{
        background: "var(--color-surface-2)",
        color: "var(--color-text-tertiary)",
        boxShadow: "0 32px 64px oklch(0 0 0 / 0.5)",
      }}
      aria-hidden="true"
    >
      <ImageUnavailableIcon size={40} />
    </div>
  );
}

export function VideoPlayBadge({ size = "md" }: VideoPlayBadgeProps) {
  const className =
    size === "sm"
      ? "absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full transition-opacity duration-150 group-hover:opacity-0"
      : "absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full transition-opacity duration-150 group-hover:opacity-0";
  const iconSize = size === "sm" ? 10 : 12;

  return (
    <div
      className={className}
      style={{ background: "oklch(0.1 0.01 260 / 0.7)" }}
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 16 16" fill="white">
        <path d="M4 2l10 6-10 6V2z" />
      </svg>
    </div>
  );
}
