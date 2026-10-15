import { FINISH, YARD } from "./engine";
import { createGameFromOptions, sanitise, type GameOptions } from "./options";
import type { GameState } from "./types";

/** A game in progress, enough to pick it up again after a reload. */
export interface SavedGame {
  version: 1;
  state: GameState;
  /** The AI's seed, so an AI game resumes with the same choices it would have made. */
  aiSeed: number;
  opts: GameOptions;
}

export const SAVE_KEY = "rollway-save";

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function isStateShape(x: unknown): x is GameState {
  if (!isRecord(x)) return false;
  if (!Array.isArray(x.players) || x.players.length < 2 || x.players.length > 4) return false;
  const players = x.players as unknown[];
  const playersOk = players.every(
    (p) =>
      isRecord(p) &&
      typeof p.colour === "string" &&
      Array.isArray(p.tokens) &&
      p.tokens.length === 4 &&
      (p.tokens as unknown[]).every(
        (t) => isRecord(t) && Number.isInteger(t.index) && Number.isInteger(t.progress) && (t.progress as number) >= YARD && (t.progress as number) <= FINISH,
      ),
  );
  if (!playersOk) return false;
  if (!Number.isInteger(x.current) || (x.current as number) < 0 || (x.current as number) >= players.length) return false;
  if (x.phase !== "roll" && x.phase !== "move" && x.phase !== "over") return false;
  if (x.die !== null && !(Number.isInteger(x.die) && (x.die as number) >= 1 && (x.die as number) <= 6)) return false;
  if (!Number.isInteger(x.sixesInRow) || !Number.isInteger(x.turns) || (x.turns as number) < 0) return false;
  if (!Number.isInteger(x.seed)) return false;
  return isRecord(x.rules) && typeof x.rules.threeSixesForfeit === "boolean" && typeof x.rules.teamMode === "boolean";
}

/** Whether a parsed value is a save this version can resume. Anything else is treated as no save. */
export function isSavedGame(x: unknown): x is SavedGame {
  if (!isRecord(x) || x.version !== 1) return false;
  if (!isStateShape(x.state) || !Number.isInteger(x.aiSeed)) return false;
  // The saved options must describe the same number of seats as the saved game.
  return isRecord(x.opts) && sanitise(x.opts).numSeats === x.state.players.length;
}

/** A seed for the dice or the AI. Random at the start of a game; the seed is then carried in the save. */
function randomSeed(): number {
  return Math.floor(Math.random() * 0xfffffffe) + 1;
}

/** A fresh game under these options, ready to save. */
export function newSavedGame(opts: GameOptions): SavedGame {
  return { version: 1, state: createGameFromOptions(randomSeed(), opts), aiSeed: randomSeed(), opts };
}

/** Write the game so far. Storage can be full or blocked, so a failure is ignored. */
export function saveGame(saved: SavedGame): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
  } catch {
    // The game still runs; it just won't survive a reload.
  }
}

/** The saved game, or null when there is none or it cannot be read. */
export function loadGame(): SavedGame | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSavedGame(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Remove the save, e.g. once the game is over. */
export function clearGame(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}
