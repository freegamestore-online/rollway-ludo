// Copyright (c) 2026 FreeGameStore. MIT License, see LICENSE. Original artwork for this game.
import { useEffect, useState, type CSSProperties } from "react";
import { FINISH, SAFE_CELLS, YARD } from "./game/engine";
import { CENTRE, LOOP, YARD_ORIGIN, homeColumnPoints, startPoint, tokenPoint, trackPoints } from "./game/board";
import { stepProgress } from "./game/hop";
import { prefersReducedMotion } from "./motion/reducedMotion";
import type { Colour, Player } from "./game/types";

/** Time between hop steps, in ms. */
const HOP_MS = 130;

const COLOUR_NAMES: Record<Colour, string> = { red: "Red", green: "Green", yellow: "Yellow", blue: "Blue" };

/** Token and home colours. Each colour also has its own shape, so colour is never the only cue. */
const FILL: Record<Colour, string> = { red: "#dc2626", green: "#16a34a", yellow: "#facc15", blue: "#2563eb" };
const INK_ON: Record<Colour, string> = { red: "#ffffff", green: "#ffffff", yellow: "#111111", blue: "#ffffff" };

/** Star points for a safe square, centred on the origin with radius 0.3. */
const STAR = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 === 0 ? 0.3 : 0.13;
  const a = (Math.PI / 5) * i - Math.PI / 2;
  return `${(r * Math.cos(a)).toFixed(3)},${(r * Math.sin(a)).toFixed(3)}`;
}).join(" ");

interface Shown {
  progress: number;
  /** Bumped on each capture, so the knock animation replays. */
  kick: number;
  /** Bumped on each arrival at the centre, so the celebration replays. */
  home: number;
}

type ShownMap = Record<string, Shown>;

const keyOf = (colour: Colour, index: number) => `${colour}-${index}`;

function initialShown(players: Player[]): ShownMap {
  const map: ShownMap = {};
  for (const p of players) {
    for (const t of p.tokens) map[keyOf(p.colour, t.index)] = { progress: t.progress, kick: 0, home: 0 };
  }
  return map;
}

/** Whether any token is still drawn somewhere other than where the game says it is. */
function isMoving(shown: ShownMap, players: Player[]): boolean {
  return players.some((p) =>
    p.tokens.some((t) => (shown[keyOf(p.colour, t.index)]?.progress ?? t.progress) !== t.progress),
  );
}

/** One hop step for every token that is behind the game state. */
function advance(shown: ShownMap, players: Player[], reduced: boolean): ShownMap {
  const next: ShownMap = { ...shown };
  for (const p of players) {
    for (const t of p.tokens) {
      const key = keyOf(p.colour, t.index);
      const cur = shown[key] ?? { progress: t.progress, kick: 0, home: 0 };
      if (cur.progress === t.progress) continue;
      const step = stepProgress(cur.progress, t.progress, reduced);
      next[key] = {
        progress: step.progress,
        kick: cur.kick + (step.kicked ? 1 : 0),
        home: cur.home + (step.progress === FINISH && cur.progress !== FINISH ? 1 : 0),
      };
    }
  }
  return next;
}

interface BoardProps {
  players: Player[];
}

/**
 * The board: the loop, the home columns, the yards and the centre, with every
 * token drawn as a numbered shape. Tokens hop one square at a time, and captures
 * knock back. The game state is the truth; this only paces how it is drawn.
 */
export default function Board({ players }: BoardProps) {
  const [shown, setShown] = useState(() => initialShown(players));

  useEffect(() => {
    if (!isMoving(shown, players)) return;
    const reduced = prefersReducedMotion();
    const timer = window.setTimeout(() => setShown((s) => advance(s, players, reduced)), reduced ? 0 : HOP_MS);
    return () => window.clearTimeout(timer);
  }, [shown, players]);

  return (
    <svg viewBox="0 0 15 15" role="img" aria-label="Ludo board" className="w-full h-full">
      <rect x={0} y={0} width={15} height={15} rx={0.4} fill="var(--panel)" />

      {/* Yards: a corner block for each colour. */}
      {(["red", "green", "yellow", "blue"] as Colour[]).map((c) => {
        const [x, y] = YARD_ORIGIN[c];
        return (
          <rect key={c} x={x + 0.1} y={y + 0.1} width={5.8} height={5.8} rx={0.5} fill={FILL[c]} fillOpacity={0.14} stroke={FILL[c]} strokeOpacity={0.5} strokeWidth={0.05} />
        );
      })}

      {/* Track: one tile per loop cell. */}
      {trackPoints().map((p, i) => (
        <rect
          key={i}
          x={p.x - 0.42}
          y={p.y - 0.42}
          width={0.84}
          height={0.84}
          rx={0.16}
          fill="var(--paper)"
          stroke="var(--line-strong)"
          strokeWidth={0.04}
        />
      ))}

      {/* Each colour's start square, filled in its colour. */}
      {(["red", "green", "yellow", "blue"] as Colour[]).map((c) => {
        const p = startPoint(c);
        return <rect key={c} x={p.x - 0.42} y={p.y - 0.42} width={0.84} height={0.84} rx={0.16} fill={FILL[c]} fillOpacity={0.55} />;
      })}

      {/* Safe squares, including each start square, are marked with a star. */}
      {[...SAFE_CELLS].map((cell) => {
        const [col, row] = LOOP[cell]!;
        return <polygon key={`safe-${cell}`} points={STAR} transform={`translate(${col + 0.5} ${row + 0.5})`} fill="var(--line-strong)" />;
      })}

      {/* Home columns, in each colour. */}
      {(["red", "green", "yellow", "blue"] as Colour[]).map((c) =>
        homeColumnPoints(c).map((p, i) => (
          <rect key={`${c}-home-${i}`} x={p.x - 0.42} y={p.y - 0.42} width={0.84} height={0.84} rx={0.16} fill={FILL[c]} fillOpacity={0.45} />
        )),
      )}

      {/* The centre is four triangles, one for each home column. */}
      <polygon points="6,6 9,6 7.5,7.5" fill={FILL.green} fillOpacity={0.6} />
      <polygon points="9,6 9,9 7.5,7.5" fill={FILL.yellow} fillOpacity={0.6} />
      <polygon points="9,9 6,9 7.5,7.5" fill={FILL.blue} fillOpacity={0.6} />
      <polygon points="6,9 6,6 7.5,7.5" fill={FILL.red} fillOpacity={0.6} />

      {/* Tokens, drawn on top of the board. */}
      {players.map((p) =>
        p.tokens.map((t) => {
          const key = keyOf(p.colour, t.index);
          const s = shown[key] ?? { progress: t.progress, kick: 0, home: 0 };
          const at = tokenPoint(p.colour, t.index, s.progress);
          return (
            <g key={key} className="lb-token" transform={`translate(${at.x} ${at.y})`}>
              <title>
                {COLOUR_NAMES[p.colour]} token {t.index + 1}
                {s.progress === YARD ? ", in the yard" : s.progress === FINISH ? ", home" : ""}
              </title>
              <g key={`kick-${s.kick}`} className="lb-knock">
                <TokenShape colour={p.colour} />
                <text
                  x={0}
                  y={0}
                  fontSize={0.36}
                  fontWeight={700}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={INK_ON[p.colour]}
                  style={{ fontFamily: "Manrope, system-ui, sans-serif" }}
                >
                  {t.index + 1}
                </text>
              </g>
            </g>
          );
        }),
      )}

      {/* Celebration: a burst at the centre each time a token gets home. */}
      {players.flatMap((p) =>
        p.tokens.map((t) => {
          const s = shown[keyOf(p.colour, t.index)];
          if (!s || s.home === 0) return null;
          return <Burst key={`${keyOf(p.colour, t.index)}-${s.home}`} colour={p.colour} />;
        }),
      )}
    </svg>
  );
}

/** One shape per colour: a circle, a triangle, a square, or a diamond. */
function TokenShape({ colour }: { colour: Colour }) {
  const common = { fill: FILL[colour], stroke: "var(--paper)", strokeWidth: 0.07 };
  switch (colour) {
    case "red":
      return <circle r={0.38} {...common} />;
    case "green":
      return <polygon points="0,-0.4 0.37,0.3 -0.37,0.3" {...common} />;
    case "yellow":
      return <rect x={-0.34} y={-0.34} width={0.68} height={0.68} rx={0.08} {...common} />;
    case "blue":
      return <polygon points="0,-0.4 0.4,0 0,0.4 -0.4,0" {...common} />;
  }
}

function Burst({ colour }: { colour: Colour }) {
  const dots = Array.from({ length: 8 }, (_, i) => {
    const a = (Math.PI / 4) * i;
    return { dx: (Math.cos(a) * 1.1).toFixed(3), dy: (Math.sin(a) * 1.1).toFixed(3), i };
  });
  return (
    <g transform={`translate(${CENTRE.x} ${CENTRE.y})`} className="lb-burst">
      <circle r={0.3} fill="none" stroke={FILL[colour]} strokeWidth={0.12} className="lb-burst-ring" />
      {dots.map((d) => (
        <circle
          key={d.i}
          r={0.09}
          fill={FILL[colour]}
          className="lb-burst-dot"
          style={{ "--dx": `${d.dx}px`, "--dy": `${d.dy}px` } as CSSProperties}
        />
      ))}
    </g>
  );
}
