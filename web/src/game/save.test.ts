import { beforeEach, describe, expect, it } from "vitest";
import { applyMove, createGame, FINISH } from "./engine";
import { DEFAULT_OPTIONS, type GameOptions } from "./options";
import { SAVE_KEY, clearGame, isSavedGame, loadGame, newSavedGame, saveGame, type SavedGame } from "./save";

beforeEach(() => {
  localStorage.clear();
});

function sample(opts: GameOptions = DEFAULT_OPTIONS): SavedGame {
  return { version: 1, state: createGame(7), aiSeed: 99, opts };
}

describe("saveGame and loadGame", () => {
  it("round-trips a game in progress", () => {
    const saved = sample();
    saveGame(saved);
    expect(loadGame()).toEqual(saved);
  });

  it("keeps the game as it is after a move", () => {
    const moved = applyMove(createGame(3), { type: "roll" });
    saveGame({ version: 1, state: moved, aiSeed: 5, opts: DEFAULT_OPTIONS });
    expect(loadGame()?.state).toEqual(moved);
  });

  it("returns null when nothing is saved", () => {
    expect(loadGame()).toBeNull();
  });

  it("returns null for unparseable JSON", () => {
    localStorage.setItem(SAVE_KEY, "{oops");
    expect(loadGame()).toBeNull();
  });

  it("returns null for a save from another version", () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...sample(), version: 2 }));
    expect(loadGame()).toBeNull();
  });

  it("returns null when the seat count does not match the saved options", () => {
    const threeSeats = { ...sample(), opts: { ...DEFAULT_OPTIONS, numSeats: 3 as const } };
    localStorage.setItem(SAVE_KEY, JSON.stringify(threeSeats));
    expect(loadGame()).toBeNull();
  });

  it("returns null when a token position is out of range", () => {
    const bad = sample();
    bad.state.players[0]!.tokens[0]!.progress = FINISH + 5;
    localStorage.setItem(SAVE_KEY, JSON.stringify(bad));
    expect(loadGame()).toBeNull();
  });

  it("returns null when the current player is out of range", () => {
    const bad = { ...sample(), state: { ...createGame(1), current: 9 } };
    localStorage.setItem(SAVE_KEY, JSON.stringify(bad));
    expect(loadGame()).toBeNull();
  });
});

describe("clearGame", () => {
  it("removes the save", () => {
    saveGame(sample());
    clearGame();
    expect(loadGame()).toBeNull();
  });
});

describe("newSavedGame", () => {
  it("makes a valid save for the given options", () => {
    const fresh = newSavedGame({ ...DEFAULT_OPTIONS, numSeats: 2 });
    expect(isSavedGame(fresh)).toBe(true);
    expect(fresh.state.players).toHaveLength(2);
    expect(fresh.state.phase).toBe("roll");
  });

  it("starts each game from a different seed", () => {
    const a = newSavedGame(DEFAULT_OPTIONS);
    const b = newSavedGame(DEFAULT_OPTIONS);
    expect(a.state.seed).not.toBe(b.state.seed);
  });
});
