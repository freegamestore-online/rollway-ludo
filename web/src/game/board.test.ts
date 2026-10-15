import { describe, expect, it } from "vitest";
import { FINISH, HOME_FIRST, MAIN_LAST, SAFE_CELLS, START_CELL, YARD, TRACK_LENGTH } from "./engine";
import { CENTRE, LOOP, isLoopCell, startPoint, tokenPoint } from "./board";
import { stepProgress } from "./hop";
import type { Colour } from "./types";

const COLOURS: Colour[] = ["red", "green", "yellow", "blue"];

function inCentre(col: number, row: number): boolean {
  return col >= 6 && col <= 8 && row >= 6 && row <= 8;
}

function inYard(col: number, row: number): boolean {
  const corners: [number, number][] = [
    [0, 0],
    [9, 0],
    [9, 9],
    [0, 9],
  ];
  return corners.some(([x, y]) => col >= x && col <= x + 5 && row >= y && row <= y + 5);
}

describe("track loop", () => {
  it("has 52 distinct cells", () => {
    expect(LOOP).toHaveLength(TRACK_LENGTH);
    expect(new Set(LOOP.map(([c, r]) => `${c},${r}`)).size).toBe(TRACK_LENGTH);
  });

  it("keeps every cell on the 15 × 15 grid, clear of the yards and the centre", () => {
    for (const [col, row] of LOOP) {
      expect(col).toBeGreaterThanOrEqual(0);
      expect(col).toBeLessThanOrEqual(14);
      expect(row).toBeGreaterThanOrEqual(0);
      expect(row).toBeLessThanOrEqual(14);
      expect(inYard(col, row)).toBe(false);
      expect(inCentre(col, row)).toBe(false);
    }
  });

  it("links each cell to the next by an edge, or across a notch corner", () => {
    for (let i = 0; i < LOOP.length; i++) {
      const [c1, r1] = LOOP[i]!;
      const [c2, r2] = LOOP[(i + 1) % LOOP.length]!;
      const dx = Math.abs(c1 - c2);
      const dy = Math.abs(r1 - r2);
      expect(dx <= 1 && dy <= 1 && dx + dy >= 1).toBe(true);
    }
  });

  it("answers isLoopCell for track cells only", () => {
    expect(isLoopCell(0, 6)).toBe(true);
    expect(isLoopCell(7, 7)).toBe(false);
    expect(isLoopCell(2, 2)).toBe(false);
  });
});

describe("start and home squares", () => {
  it("puts each colour's start square at the cell the engine names", () => {
    for (const colour of COLOURS) {
      const [col, row] = LOOP[START_CELL[colour]]!;
      expect(startPoint(colour)).toEqual({ x: col + 0.5, y: row + 0.5 });
    }
  });

  it("starts the safe squares on the loop", () => {
    for (const cell of SAFE_CELLS) expect(LOOP[cell]).toBeDefined();
  });

  it("joins each colour's last track square to the first home-column square", () => {
    for (const colour of COLOURS) {
      const last = tokenPoint(colour, 0, MAIN_LAST);
      const firstHome = tokenPoint(colour, 0, HOME_FIRST);
      const step = Math.abs(last.x - firstHome.x) + Math.abs(last.y - firstHome.y);
      expect(step).toBeCloseTo(1, 5);
    }
  });

  it("draws the finish at the centre of the board", () => {
    for (const colour of COLOURS) {
      const finish = tokenPoint(colour, 0, FINISH);
      expect(Math.abs(finish.x - CENTRE.x)).toBeLessThan(0.5);
      expect(Math.abs(finish.y - CENTRE.y)).toBeLessThan(0.5);
    }
  });

  it("gives each token its own yard slot inside the colour's corner block", () => {
    for (const colour of COLOURS) {
      const spots = [0, 1, 2, 3].map((i) => tokenPoint(colour, i, YARD));
      expect(new Set(spots.map((p) => `${p.x},${p.y}`)).size).toBe(4);
      for (const p of spots) expect(inYard(Math.floor(p.x), Math.floor(p.y))).toBe(true);
    }
  });
});

describe("hop steps", () => {
  it("moves one square at a time on the track", () => {
    expect(stepProgress(4, 7, false)).toEqual({ progress: 5, kicked: false });
  });

  it("exits the yard onto the start square", () => {
    expect(stepProgress(YARD, 0, false)).toEqual({ progress: 0, kicked: false });
  });

  it("knocks a captured token back to the yard", () => {
    expect(stepProgress(30, YARD, false)).toEqual({ progress: YARD, kicked: true });
  });

  it("does not knock a token that is already in the yard", () => {
    expect(stepProgress(YARD, YARD, false)).toEqual({ progress: YARD, kicked: false });
  });

  it("jumps straight to the target with reduced motion", () => {
    expect(stepProgress(4, 9, true)).toEqual({ progress: 9, kicked: false });
    expect(stepProgress(30, YARD, true)).toEqual({ progress: YARD, kicked: true });
  });

  it("never steps past the finish", () => {
    expect(stepProgress(FINISH, FINISH, false).progress).toBe(FINISH);
  });
});
