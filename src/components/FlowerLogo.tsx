import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const PETALS = 6;
const RING = 11;
const PETAL_R = 10;
const WOBBLE = 0.05;
const CENTER_R = 6;
const LIFT = 5;

const COLORS = [
  "#F08A2E", // top
  "#E85A8A",
  "#E54B3C",
  "#138B7A",
  "#6BC07A",
  "#2DB1C4",
];

interface Petal {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rot: number;
  dx: number;
  dy: number;
  color: string;
}

const petals: Petal[] = Array.from({ length: PETALS }, (_, i) => {
  const angle = (i / PETALS) * Math.PI * 2 - Math.PI / 2;
  const cx = 32 + Math.cos(angle) * RING;
  const cy = 32 + Math.sin(angle) * RING;
  const r = PETAL_R * (1 + (i % 2 === 0 ? WOBBLE : -WOBBLE));
  return {
    cx,
    cy,
    rx: r,
    ry: r * (1 - WOBBLE * 0.6),
    rot: (angle * 180) / Math.PI + 90,
    dx: Math.cos(angle),
    dy: Math.sin(angle),
    color: COLORS[i % COLORS.length],
  };
});

interface FlowerLogoProps {
  size?: number;
  className?: string;
}

export function FlowerLogo({ size = 44, className }: FlowerLogoProps) {
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      style={{ overflow: "visible" }}
      aria-hidden="true"
    >
      {/* Visible animated petals */}
      {petals.map((p, i) => {
        const lift = !reduced && hovered === i;
        return (
          <motion.g
            key={`petal-${i}`}
            animate={{
              x: lift ? p.dx * LIFT : 0,
              y: lift ? p.dy * LIFT : 0,
            }}
            transition={{
              type: "spring",
              stiffness: 380,
              damping: 18,
              mass: 0.5,
            }}
          >
            <ellipse
              cx={p.cx}
              cy={p.cy}
              rx={p.rx}
              ry={p.ry}
              transform={`rotate(${p.rot} ${p.cx} ${p.cy})`}
              fill={p.color}
            />
          </motion.g>
        );
      })}

      {/* Yellow core (static) */}
      <circle cx={32} cy={32} r={CENTER_R} fill="#FFD24D" />

      {/* Static transparent hit zones — stay put so the lift can't drag hover off. */}
      {petals.map((p, i) => (
        <ellipse
          key={`hit-${i}`}
          cx={p.cx}
          cy={p.cy}
          rx={p.rx}
          ry={p.ry}
          transform={`rotate(${p.rot} ${p.cx} ${p.cy})`}
          fill="transparent"
          pointerEvents="all"
          style={{ cursor: "pointer" }}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
        />
      ))}
    </svg>
  );
}
