import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  motionValue,
  type MotionValue,
  useReducedMotion,
} from "framer-motion";

const PETALS = 6;
const RING = 11;
const PETAL_R = 10;
const WOBBLE = 0.05;
const CENTER_R = 6;
const LIFT = 5;

// Flight physics, in viewBox units (64×64). Tuned subtle for the 44px nav logo.
const V0 = 34;            // initial radial speed
const V0_JITTER = 6;
const GRAVITY = 50;       // pulls petal down during flight
const DRAG = 1.1;         // air resistance (v *= exp(-DRAG*dt))
const WIND_AMP = 6;
const WIND_FREQ = 2.0;
const SPIN_MIN = 90;      // deg/sec
const SPIN_MAX = 240;
const UPWARD_BIAS = 10;   // initial negative vy for nicer arc
const FLIGHT_TIME = 0.42; // sec of ballistic flight before spring return

const HOVER_SPRING = { type: "spring", stiffness: 380, damping: 18, mass: 0.5 } as const;
const RETURN_SPRING = { type: "spring", stiffness: 260, damping: 22, mass: 1 } as const;
const RETURN_ROT_SPRING = { type: "spring", stiffness: 220, damping: 20, mass: 1 } as const;

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

// Impure init for a flight — kept at module scope so the component body stays pure.
function initFlight(p: Petal) {
  const speed = V0 + (Math.random() * 2 - 1) * V0_JITTER;
  return {
    vx: p.dx * speed,
    vy: p.dy * speed - UPWARD_BIAS,
    spin:
      (SPIN_MIN + Math.random() * (SPIN_MAX - SPIN_MIN)) *
      (Math.random() < 0.5 ? -1 : 1),
    windPhase: Math.random() * Math.PI * 2,
    windSign: Math.random() < 0.5 ? -1 : 1,
  };
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
  const hoveredRef = useRef<number | null>(null);
  useEffect(() => {
    hoveredRef.current = hovered;
  }, [hovered]);

  // One motion value trio per petal — created once on mount.
  const [mvs] = useState<
    { x: MotionValue<number>; y: MotionValue<number>; rot: MotionValue<number> }[]
  >(() =>
    petals.map(() => ({
      x: motionValue(0),
      y: motionValue(0),
      rot: motionValue(0),
    })),
  );

  const flyingRef = useRef<Set<number>>(new Set());
  const rafRef = useRef<Map<number, number>>(new Map());

  // Drive hover lift imperatively so it doesn't fight the flight loop.
  useEffect(() => {
    if (reduced) return;
    petals.forEach((p, i) => {
      if (flyingRef.current.has(i)) return;
      const lifted = hovered === i;
      animate(mvs[i].x, lifted ? p.dx * LIFT : 0, HOVER_SPRING);
      animate(mvs[i].y, lifted ? p.dy * LIFT : 0, HOVER_SPRING);
    });
  }, [hovered, reduced, mvs]);

  useEffect(() => {
    const rafs = rafRef.current;
    return () => {
      rafs.forEach((id) => cancelAnimationFrame(id));
      rafs.clear();
    };
  }, []);

  function flick(i: number) {
    if (reduced) return;
    if (flyingRef.current.has(i)) return;
    flyingRef.current.add(i);

    const p = petals[i];
    const x = mvs[i].x;
    const y = mvs[i].y;
    const rot = mvs[i].rot;

    const tx = -p.dy;
    const ty = p.dx;
    const init = initFlight(p);
    let vx = init.vx;
    let vy = init.vy;
    const spin = init.spin;
    const windPhase = init.windPhase;
    const windSign = init.windSign;

    let t = 0;
    let last = 0;
    let px = 0;
    let py = 0;

    const frame = (now: number) => {
      const dt = last === 0 ? 0 : Math.min(0.032, (now - last) / 1000);
      last = now;
      t += dt;

      const decay = Math.exp(-DRAG * dt);
      vx *= decay;
      vy *= decay;
      vy += GRAVITY * dt;

      px += vx * dt;
      py += vy * dt;
      const curRot = rot.get() + spin * dt;
      rot.set(curRot);

      const swayEnv =
        Math.min(1, t * 2.2) * Math.max(0, 1 - t / FLIGHT_TIME);
      const sway =
        Math.sin(t * WIND_FREQ * Math.PI * 2 + windPhase) *
        WIND_AMP *
        swayEnv *
        windSign;
      x.set(px + tx * sway);
      y.set(py + ty * sway);

      if (t < FLIGHT_TIME) {
        rafRef.current.set(i, requestAnimationFrame(frame));
        return;
      }

      // Hand off to spring-driven return with carry-over velocity.
      rafRef.current.delete(i);
      const done = { pos: 0, rotDone: false };
      const finish = () => {
        flyingRef.current.delete(i);
        // If pointer is still over the petal, re-apply hover lift.
        if (hoveredRef.current === i) {
          animate(x, p.dx * LIFT, HOVER_SPRING);
          animate(y, p.dy * LIFT, HOVER_SPRING);
        }
      };
      animate(x, 0, {
        ...RETURN_SPRING,
        velocity: vx * 0.6,
        onComplete: () => {
          done.pos++;
          if (done.pos === 2 && done.rotDone) finish();
        },
      });
      animate(y, 0, {
        ...RETURN_SPRING,
        velocity: vy * 0.6,
        onComplete: () => {
          done.pos++;
          if (done.pos === 2 && done.rotDone) finish();
        },
      });
      animate(rot, 0, {
        ...RETURN_ROT_SPRING,
        velocity: spin * 0.4,
        onComplete: () => {
          done.rotDone = true;
          if (done.pos === 2) finish();
        },
      });
    };
    rafRef.current.set(i, requestAnimationFrame(frame));
  }

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
      {petals.map((p, i) => (
        <motion.g
          key={`petal-${i}`}
          style={{ x: mvs[i].x, y: mvs[i].y, rotate: mvs[i].rot }}
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

      {/* Yellow core (static) */}
      <circle cx={32} cy={32} r={CENTER_R} fill="#FFD24D" />

      {/* Static transparent hit zones — stay put so lift/flight can't drag hover off. */}
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
          onClick={() => flick(i)}
        />
      ))}
    </svg>
  );
}
