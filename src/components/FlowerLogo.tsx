import { motion, useReducedMotion } from "framer-motion";

const PETALS = 6;
const RING = 11;
const PETAL_R = 10;
const WOBBLE = 0.05;
const CENTER_R = 6;
const LIFT = 2.6;

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

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      initial="rest"
      whileHover={reduced ? undefined : "hover"}
      animate="rest"
      style={{ overflow: "visible" }}
      aria-hidden="true"
    >
      {petals.map((p, i) => (
        <motion.g
          key={i}
          variants={{
            rest: { x: 0, y: 0 },
            hover: { x: p.dx * LIFT, y: p.dy * LIFT },
          }}
          transition={{
            type: "spring",
            stiffness: 320,
            damping: 16,
            mass: 0.5,
            delay: i * 0.025,
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
      ))}
      <motion.circle
        cx={32}
        cy={32}
        r={CENTER_R}
        fill="#FFD24D"
        variants={{
          rest: { scale: 1 },
          hover: { scale: 1.08 },
        }}
        style={{ transformOrigin: "32px 32px" }}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
      />
    </motion.svg>
  );
}
