// Copyright (c) 2026 FreeGameStore. MIT License, see LICENSE. Original artwork for this game.

/** Pip centres on a 100 × 100 face. */
const LEFT = 28;
const MID = 50;
const RIGHT = 72;
const PIPS: Record<number, [number, number][]> = {
  1: [[MID, MID]],
  2: [[LEFT, LEFT], [RIGHT, RIGHT]],
  3: [[LEFT, LEFT], [MID, MID], [RIGHT, RIGHT]],
  4: [[LEFT, LEFT], [RIGHT, LEFT], [LEFT, RIGHT], [RIGHT, RIGHT]],
  5: [[LEFT, LEFT], [RIGHT, LEFT], [MID, MID], [LEFT, RIGHT], [RIGHT, RIGHT]],
  6: [[LEFT, LEFT], [RIGHT, LEFT], [LEFT, MID], [RIGHT, MID], [LEFT, RIGHT], [RIGHT, RIGHT]],
};

interface DieProps {
  /** The rolled face, or null before a roll is waiting to be moved. */
  value: number | null;
}

/**
 * A die face drawn as SVG. It tumbles when it mounts, so a parent that keys it by
 * roll replays the tumble on each roll. Reduced motion turns the tumble off in CSS.
 */
export default function Die({ value }: DieProps) {
  const pips = value === null ? [] : PIPS[value] ?? [];
  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label={value === null ? "Die, not rolled" : `Die shows ${value}`}
      className="lb-die w-16 h-16 shrink-0"
    >
      <rect x={4} y={4} width={92} height={92} rx={18} fill="var(--paper)" stroke="var(--ink)" strokeWidth={4} />
      {pips.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={8.5} fill="var(--ink)" />
      ))}
    </svg>
  );
}
