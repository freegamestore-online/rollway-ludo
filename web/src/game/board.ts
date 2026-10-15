// Copyright (c) 2026 FreeGameStore. MIT License, see LICENSE. Original layout for this game.
import { FINISH, HOME_FIRST, START_CELL, TRACK_LENGTH, YARD, trackCell } from "./engine";
import type { Colour } from "./types";

/** A point on the 15 × 15 board, in cell units. A cell's centre is at +0.5. */
export interface Point {
  x: number;
  y: number;
}

/**
 * The 52 main-track cells as [col, row], clockwise from red's start. Cell i is
 * the same square `trackCell` names for index i. The four notch corners of the
 * centre are skipped, so two consecutive cells there are diagonal neighbours.
 */
export const LOOP: readonly (readonly [number, number])[] = [
  [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  [7, 0],
  [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
  [14, 7],
  [14, 8], [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
  [7, 14],
  [6, 14], [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  [0, 7],
];

/** Each colour's home column, progress 52–56, leading to the centre. */
const HOME_COLUMN: Record<Colour, readonly (readonly [number, number])[]> = {
  red: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  green: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  yellow: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
  blue: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
};

/** The home triangle at the centre of the board. */
export const CENTRE: Point = { x: 7.5, y: 7.5 };

/** Each colour's yard: a 6 × 6 corner block, with four token slots inside it. */
export const YARD_ORIGIN: Record<Colour, readonly [number, number]> = {
  red: [0, 0],
  green: [9, 0],
  yellow: [9, 9],
  blue: [0, 9],
};
const YARD_SLOTS: readonly (readonly [number, number])[] = [[1.5, 1.5], [4.5, 1.5], [1.5, 4.5], [4.5, 4.5]];

/** Small offsets so tokens sharing a square stay visible. */
const STACK_OFFSETS: readonly Point[] = [
  { x: -0.18, y: -0.18 },
  { x: 0.18, y: -0.18 },
  { x: -0.18, y: 0.18 },
  { x: 0.18, y: 0.18 },
];

function cellCentre(col: number, row: number): Point {
  return { x: col + 0.5, y: row + 0.5 };
}

/** Where a token is drawn: in its yard slot, on the track, up its home column, or at the centre. */
export function tokenPoint(colour: Colour, index: number, progress: number): Point {
  const offset = STACK_OFFSETS[index % STACK_OFFSETS.length]!;
  if (progress === YARD) {
    const [ox, oy] = YARD_ORIGIN[colour];
    const [sx, sy] = YARD_SLOTS[index % YARD_SLOTS.length]!;
    return { x: ox + sx, y: oy + sy };
  }
  if (progress === FINISH) return { x: CENTRE.x + offset.x, y: CENTRE.y + offset.y };
  if (progress >= HOME_FIRST) {
    const [col, row] = HOME_COLUMN[colour][progress - HOME_FIRST]!;
    return { x: cellCentre(col, row).x + offset.x, y: cellCentre(col, row).y + offset.y };
  }
  const [col, row] = LOOP[trackCell(colour, progress)!]!;
  return { x: cellCentre(col, row).x + offset.x, y: cellCentre(col, row).y + offset.y };
}

/** The track cell for each track index, as board points, for drawing the loop. */
export function trackPoints(): Point[] {
  return LOOP.map(([col, row]) => cellCentre(col, row));
}

/** The home-column cells of a colour, as board points. */
export function homeColumnPoints(colour: Colour): Point[] {
  return HOME_COLUMN[colour].map(([col, row]) => cellCentre(col, row));
}

/** Every colour's start cell, as board points. */
export function startPoint(colour: Colour): Point {
  const [col, row] = LOOP[START_CELL[colour] % TRACK_LENGTH]!;
  return cellCentre(col, row);
}

/** Whether a cell is one of the 52 main-track cells. Yards, home columns, the centre and notch corners are not. */
export function isLoopCell(col: number, row: number): boolean {
  return LOOP.some(([c, r]) => c === col && r === row);
}
