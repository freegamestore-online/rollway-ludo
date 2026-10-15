import type { Difficulty, Seats } from "./ai";
import { COLOURS, createGame } from "./engine";
import type { GameState } from "./types";

export type SeatConfig = { type: "human" } | { type: "ai"; difficulty: Difficulty };

export interface GameOptions {
  numSeats: 2 | 3 | 4;
  /** One entry per seat in turn order. Only the first `numSeats` are used. */
  seats: [SeatConfig, SeatConfig, SeatConfig, SeatConfig];
  /** 2v2 team play. Needs four seats, so it is ignored otherwise. */
  teamMode: boolean;
  threeSixesForfeit: boolean;
  /** Apply a move without a tap when it is the only legal one. */
  autoMove: boolean;
}

export const STORAGE_KEY = "rollway-options";

const SEAT_COUNTS: readonly number[] = [2, 3, 4];
const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard"];

export const DEFAULT_OPTIONS: GameOptions = {
  numSeats: 4,
  seats: [{ type: "human" }, { type: "human" }, { type: "human" }, { type: "human" }],
  teamMode: false,
  threeSixesForfeit: true,
  autoMove: false,
};

/** Write the options to localStorage. Storage can be full or disabled, so a failure is ignored. */
export function saveOptions(opts: GameOptions): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
  } catch {
    // Options just won't survive a reload.
  }
}

/** Read the saved options, falling back to the default for anything missing or invalid. */
export function loadOptions(): GameOptions {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? cloneDefaults() : sanitise(JSON.parse(raw));
  } catch {
    return cloneDefaults();
  }
}

/** Check untrusted input (from storage) field by field, so one bad field doesn't discard the rest. */
export function sanitise(raw: unknown): GameOptions {
  const base = cloneDefaults();
  if (typeof raw !== "object" || raw === null) return base;
  const input = raw as Record<string, unknown>;

  if (typeof input.numSeats === "number" && SEAT_COUNTS.includes(input.numSeats)) {
    base.numSeats = input.numSeats as 2 | 3 | 4;
  }
  if (Array.isArray(input.seats)) {
    base.seats = [0, 1, 2, 3].map((i) => parseSeat(input.seats as unknown[], i)) as GameOptions["seats"];
  }
  if (typeof input.teamMode === "boolean") base.teamMode = input.teamMode;
  if (typeof input.threeSixesForfeit === "boolean") base.threeSixesForfeit = input.threeSixesForfeit;
  if (typeof input.autoMove === "boolean") base.autoMove = input.autoMove;
  return base;
}

/** Team mode only exists with four seats, so it is off for two or three. */
export function effectiveTeamMode(opts: GameOptions): boolean {
  return opts.teamMode && opts.numSeats === 4;
}

/** The engine settings these options describe. */
export function engineConfig(opts: GameOptions) {
  return {
    colours: COLOURS.slice(0, opts.numSeats),
    rules: { threeSixesForfeit: opts.threeSixesForfeit, teamMode: effectiveTeamMode(opts) },
  };
}

/** Which colours are AI-controlled, and how hard. Human seats are left out. */
export function buildSeats(opts: GameOptions): Seats {
  const seats: Seats = {};
  COLOURS.slice(0, opts.numSeats).forEach((colour, i) => {
    const seat = opts.seats[i];
    if (seat?.type === "ai") seats[colour] = seat.difficulty;
  });
  return seats;
}

/** A new game under these options. The seed fixes the dice, so the same seed replays the same game. */
export function createGameFromOptions(seed: number, opts: GameOptions): GameState {
  return createGame(seed, engineConfig(opts));
}

function parseSeat(seats: unknown[], i: number): SeatConfig {
  const seat = seats[i];
  if (typeof seat !== "object" || seat === null) return { type: "human" };
  const input = seat as Record<string, unknown>;
  if (input.type === "ai" && DIFFICULTIES.includes(input.difficulty as Difficulty)) {
    return { type: "ai", difficulty: input.difficulty as Difficulty };
  }
  return { type: "human" };
}

function cloneDefaults(): GameOptions {
  return {
    ...DEFAULT_OPTIONS,
    seats: DEFAULT_OPTIONS.seats.map((s) => ({ ...s })) as GameOptions["seats"],
  };
}
