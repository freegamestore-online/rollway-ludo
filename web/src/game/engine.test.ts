import { describe, expect, it } from "vitest";
import {
  FINISH,
  HOME_FIRST,
  MAIN_LAST,
  SAFE_CELLS,
  YARD,
  applyMove,
  canMove,
  createGame,
  legalMoves,
  rollDie,
  trackCell,
} from "./engine";
import type { Colour, GameState, Token } from "./types";

/** A game where the pending roll is already `die`, with `colour` to move. */
function moving(die: number, patch: Partial<GameState> = {}): GameState {
  return { ...createGame(1), phase: "move", die, ...patch };
}

/** Put one token of `colour` at `progress`, leaving everything else as it is. */
function place(state: GameState, colour: Colour, index: number, progress: number): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.colour !== colour
        ? p
        : { ...p, tokens: p.tokens.map((t): Token => (t.index === index ? { ...t, progress } : t)) },
    ),
  };
}

function tokenOf(state: GameState, colour: Colour, index: number): Token {
  const token = state.players.find((p) => p.colour === colour)?.tokens.find((t) => t.index === index);
  if (!token) throw new Error(`no ${colour} token ${index}`);
  return token;
}

/** The first seed whose die roll is `value`. Deterministic, so tests can pick a roll. */
function seedFor(value: number): number {
  for (let seed = 1; seed < 10_000; seed++) if (rollDie(seed).value === value) return seed;
  throw new Error(`no seed rolls ${value}`);
}

describe("rollDie", () => {
  it("gives the same sequence for the same seed", () => {
    const run = (seed: number) => {
      const values: number[] = [];
      let s = seed;
      for (let i = 0; i < 50; i++) {
        const r = rollDie(s);
        values.push(r.value);
        s = r.nextSeed;
      }
      return values;
    };
    expect(run(12345)).toEqual(run(12345));
  });

  it("gives different next seeds for different seeds", () => {
    expect(rollDie(1).nextSeed).not.toBe(rollDie(2).nextSeed);
  });

  it("always returns a face from 1 to 6", () => {
    let s = 7;
    for (let i = 0; i < 1000; i++) {
      const r = rollDie(s);
      expect(r.value).toBeGreaterThanOrEqual(1);
      expect(r.value).toBeLessThanOrEqual(6);
      s = r.nextSeed;
    }
  });

  it("does not get stuck on a zero seed", () => {
    expect(rollDie(0).nextSeed).not.toBe(0);
  });

  it("makes the game's rolls reproducible from the seed", () => {
    const rollTwice = (seed: number) => {
      const first = applyMove(createGame(seed), { type: "roll" });
      return applyMove(applyMove(first, { type: "move", colour: "red", index: 0 }), { type: "roll" }).die;
    };
    expect(rollTwice(99)).toBe(rollTwice(99));
  });
});

describe("yard exit", () => {
  it("moves a token from the yard onto its start square on a six", () => {
    const state = moving(6);
    const next = applyMove(state, { type: "move", colour: "red", index: 0 });
    expect(tokenOf(next, "red", 0).progress).toBe(0);
    expect(trackCell("red", 0)).toBe(0);
  });

  it("cannot bring a token out on any other roll", () => {
    for (let die = 1; die <= 5; die++) {
      expect(canMove({ index: 0, progress: YARD }, die)).toBe(false);
    }
    expect(() => applyMove(moving(3), { type: "move", colour: "red", index: 0 })).toThrow();
  });

  it("lists no legal moves for yard tokens unless the roll is a six", () => {
    expect(legalMoves(moving(4))).toEqual([]);
    expect(legalMoves(moving(6))).toHaveLength(4);
  });
});

describe("extra roll and sixes", () => {
  it("grants an extra roll to the same player after a six", () => {
    const next = applyMove(moving(6), { type: "move", colour: "red", index: 0 });
    expect(next.phase).toBe("roll");
    expect(next.current).toBe(0);
    expect(next.die).toBeNull();
  });

  it("passes the turn after a non-six move", () => {
    const next = applyMove(place(moving(3), "red", 0, 0), { type: "move", colour: "red", index: 0 });
    expect(next.current).toBe(1);
    expect(next.phase).toBe("roll");
  });

  it("forfeits the turn on a third six in a row, without moving", () => {
    const state = createGame(seedFor(6), { colours: ["red", "green"] });
    const primed = place({ ...state, sixesInRow: 2 }, "red", 0, 10);
    const next = applyMove(primed, { type: "roll" });
    expect(next.current).toBe(1);
    expect(next.sixesInRow).toBe(0);
    expect(next.phase).toBe("roll");
    expect(tokenOf(next, "red", 0).progress).toBe(10);
  });

  it("does not forfeit on a third six when the rule is off", () => {
    const state = createGame(seedFor(6), { rules: { threeSixesForfeit: false } });
    const primed = place({ ...state, sixesInRow: 2 }, "red", 0, 10);
    const next = applyMove(primed, { type: "roll" });
    expect(next.current).toBe(0);
    expect(next.sixesInRow).toBe(3);
    expect(next.phase).toBe("move");
  });

  it("resets the sixes count when a non-six is rolled", () => {
    const state = createGame(seedFor(2), { colours: ["red", "green"] });
    const next = applyMove({ ...state, sixesInRow: 2 }, { type: "roll" });
    expect(next.sixesInRow).toBe(0);
    expect(next.current).toBe(1);
  });
});

describe("captures", () => {
  it("sends an opponent on a non-safe square back to its yard", () => {
    // Red steps from progress 1 (cell 1) to progress 3 (cell 3). Green progress 42 is cell 3.
    const state = place(place(moving(2), "red", 0, 1), "green", 0, 42);
    expect(trackCell("green", 42)).toBe(3);
    expect(SAFE_CELLS.has(3)).toBe(false);
    const next = applyMove(state, { type: "move", colour: "red", index: 0 });
    expect(tokenOf(next, "green", 0).progress).toBe(YARD);
    expect(tokenOf(next, "red", 0).progress).toBe(3);
  });

  it("leaves the capturing player's own tokens alone", () => {
    const state = place(place(moving(2), "red", 0, 1), "red", 1, 3);
    const next = applyMove(state, { type: "move", colour: "red", index: 0 });
    expect(tokenOf(next, "red", 1).progress).toBe(3);
  });

  it("does not capture on a star square", () => {
    // Red steps from progress 6 to progress 8, which is the star at cell 8.
    // Green progress 47 is also cell 8.
    const state = place(place(moving(2), "red", 0, 6), "green", 0, 47);
    expect(trackCell("green", 47)).toBe(8);
    const next = applyMove(state, { type: "move", colour: "red", index: 0 });
    expect(tokenOf(next, "green", 0).progress).toBe(47);
  });
});

describe("safe squares", () => {
  it("does not capture on a colour's start square", () => {
    // Red steps from progress 38 to 39, which is blue's start square (cell 39). Blue progress 0 is cell 39.
    const state = place(place(moving(1), "red", 0, 38), "blue", 0, 0);
    expect(SAFE_CELLS.has(39)).toBe(true);
    const next = applyMove(state, { type: "move", colour: "red", index: 0 });
    expect(tokenOf(next, "blue", 0).progress).toBe(0);
  });

  it("marks exactly the four start squares and four stars as safe", () => {
    expect([...SAFE_CELLS].sort((a, b) => a - b)).toEqual([0, 8, 13, 21, 26, 34, 39, 47]);
  });
});

describe("home column and exact finish", () => {
  it("opponents never reach a home-column square", () => {
    expect(trackCell("red", HOME_FIRST)).toBeNull();
    expect(trackCell("red", FINISH)).toBeNull();
  });

  it("uses the main track up to square 51, then the home column", () => {
    expect(trackCell("red", MAIN_LAST)).toBe(51);
    expect(trackCell("red", MAIN_LAST + 1)).toBeNull();
  });

  it("finishes only on an exact roll from five squares away", () => {
    const fiveAway = place(moving(5), "red", 0, FINISH - 5);
    expect(canMove(tokenOf(fiveAway, "red", 0), 5)).toBe(true);
    expect(canMove(tokenOf(fiveAway, "red", 0), 6)).toBe(false);
    const finished = applyMove(fiveAway, { type: "move", colour: "red", index: 0 });
    expect(tokenOf(finished, "red", 0).progress).toBe(FINISH);
  });

  it("does not finish on a roll of 4 from five squares away", () => {
    const fiveAway = place(moving(4), "red", 0, FINISH - 5);
    expect(canMove(tokenOf(fiveAway, "red", 0), 4)).toBe(true);
    const next = applyMove(fiveAway, { type: "move", colour: "red", index: 0 });
    expect(tokenOf(next, "red", 0).progress).toBe(FINISH - 1);
  });

  it("refuses a roll that would overshoot the finish", () => {
    const oneAway = place(moving(2), "red", 0, FINISH - 1);
    expect(legalMoves(oneAway)).toEqual([]);
    expect(() => applyMove(oneAway, { type: "move", colour: "red", index: 0 })).toThrow("cannot move 2");
  });

  it("ends the game when a player finishes all four tokens", () => {
    let state = createGame(1);
    for (let i = 1; i < 4; i++) state = place(state, "red", i, FINISH);
    state = { ...place(state, "red", 0, FINISH - 1), phase: "move", die: 1 };
    const next = applyMove(state, { type: "move", colour: "red", index: 0 });
    expect(next.phase).toBe("over");
    expect(next.winner).toBe("red");
    expect(() => applyMove(next, { type: "roll" })).toThrow("The game is over");
  });
});

describe("turn flow", () => {
  it("skips the turn when no token can move", () => {
    const next = applyMove(createGame(seedFor(3)), { type: "roll" });
    expect(next.current).toBe(1);
    expect(next.phase).toBe("roll");
  });

  it("keeps the extra roll when a six has no legal move", () => {
    let state = createGame(seedFor(6));
    for (let i = 0; i < 4; i++) state = place(state, "red", i, FINISH - 1);
    const next = applyMove(state, { type: "roll" });
    expect(next.current).toBe(0);
    expect(next.phase).toBe("roll");
  });

  it("rejects a move before a roll", () => {
    expect(() => applyMove(createGame(1), { type: "move", colour: "red", index: 0 })).toThrow("Not time to move");
  });

  it("rejects a token of another colour", () => {
    expect(() => applyMove(moving(6), { type: "move", colour: "green", index: 0 })).toThrow("not green's turn");
  });

  it("does not modify the state it is given", () => {
    const state = moving(6);
    const before = JSON.stringify(state);
    applyMove(state, { type: "move", colour: "red", index: 0 });
    expect(JSON.stringify(state)).toBe(before);
  });
});
