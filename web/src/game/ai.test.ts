import { describe, expect, it } from "vitest";
import { chooseMove, stepAi } from "./ai";
import { FINISH, YARD, applyMove, createGame, legalMoves } from "./engine";
import type { Colour, GameState, Token } from "./types";

/** A game with `die` pending and `colours[0]` to move. */
function moving(die: number, colours?: Colour[]): GameState {
  return { ...createGame(1, colours ? { colours } : {}), phase: "move", die };
}

/** Put one token of `colour` at `progress`. */
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

describe("easy", () => {
  it("always picks a legal move", () => {
    const state = place(place(moving(6), "red", 1, 10), "red", 2, 30);
    const legal = legalMoves(state);
    for (let seed = 1; seed <= 50; seed++) {
      expect(legal).toContainEqual(chooseMove(state, "easy", seed).move);
    }
  });

  it("spreads its choices across the legal moves", () => {
    const state = place(place(moving(6), "red", 1, 10), "red", 2, 30);
    const picked = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) picked.add(JSON.stringify(chooseMove(state, "easy", seed).move));
    expect(picked.size).toBe(legalMoves(state).length);
  });

  it("is reproducible from the same seed", () => {
    const state = place(moving(6), "red", 1, 10);
    expect(chooseMove(state, "easy", 42)).toEqual(chooseMove(state, "easy", 42));
  });

  it("throws when there is no legal move", () => {
    expect(() => chooseMove(moving(3), "easy", 1)).toThrow("No legal moves");
  });
});

describe("normal", () => {
  it("takes a capture over plain progress", () => {
    // Red A (index 0) at progress 1 moves 2 onto cell 3, where green sits at progress 42.
    // Red B (index 1) at progress 10 also moves 2, but captures nothing.
    let state = place(place(moving(2), "red", 0, 1), "red", 1, 10);
    state = place(state, "green", 0, 42);
    const choice = chooseMove(state, "normal", 7);
    expect(choice.move).toEqual({ type: "move", colour: "red", index: 0 });
    const after = applyMove(state, choice.move);
    expect(after.players[1]!.tokens[0]!.progress).toBe(YARD);
  });

  it("takes a finish over plain progress", () => {
    // Red B (index 1) at FINISH - 2 finishes on a 2. Red A (index 0) at 10 only advances.
    const state = place(place(moving(2), "red", 0, 10), "red", 1, FINISH - 2);
    expect(chooseMove(state, "normal", 1).move).toEqual({ type: "move", colour: "red", index: 1 });
  });

  it("breaks ties by the lowest token index, regardless of seed", () => {
    // Both tokens gain 2 and neither captures, so the tie goes to index 0.
    const state = place(place(moving(2), "red", 0, 10), "red", 1, 20);
    expect(chooseMove(state, "normal", 1).move).toEqual({ type: "move", colour: "red", index: 0 });
    expect(chooseMove(state, "normal", 999).move).toEqual({ type: "move", colour: "red", index: 0 });
  });

  it("values leaving the yard on a six", () => {
    // Token 0 is in the yard and token 1 is at progress 2. Both score 6, so the yard exit wins on index.
    const state = place(moving(6), "red", 1, 2);
    expect(chooseMove(state, "normal", 1).move).toEqual({ type: "move", colour: "red", index: 0 });
  });
});

describe("hard", () => {
  // Green is at progress 35 (cell 48). Its reach covers red cells 49, 50, 51, 1 and 2.
  // Cell 0 is red's start, which is safe, so nothing is threatened there.

  it("moves a threatened token to safety rather than taking a plain move", () => {
    // Red A (index 1) at progress 2 (cell 2) is threatened. A six takes it to cell 8, a star.
    // Red index 0 is in the yard and can also leave on a six, which scores only the exit.
    let state = place(moving(6, ["red", "green"]), "red", 1, 2);
    state = place(state, "green", 0, 35);
    expect(chooseMove(state, "normal", 1).move).toEqual({ type: "move", colour: "red", index: 0 });
    expect(chooseMove(state, "hard", 1).move).toEqual({ type: "move", colour: "red", index: 1 });
  });

  it("does not expose a token to an opponent when it is behind on progress", () => {
    // Red A (index 0) at start moves 2 to cell 2, within green's reach. B (index 1) at 30 moves to cell 32, out of reach.
    // Both gain 2, so normal takes index 0 into danger. Hard avoids the exposure.
    let state = place(place(place(moving(2, ["red", "green"]), "red", 0, 0), "red", 1, 30), "green", 0, 35);
    expect(chooseMove(state, "normal", 1).move).toEqual({ type: "move", colour: "red", index: 0 });
    expect(chooseMove(state, "hard", 1).move).toEqual({ type: "move", colour: "red", index: 1 });
  });

  it("still takes a capture", () => {
    // Red A (index 0) at progress 1 captures green at cell 3 (progress 42). B (index 1) at 10 does not.
    let state = place(place(moving(2, ["red", "green"]), "red", 0, 1), "red", 1, 10);
    state = place(state, "green", 0, 42);
    expect(chooseMove(state, "hard", 3).move).toEqual({ type: "move", colour: "red", index: 0 });
  });

  it("is reproducible from the same seed", () => {
    const state = place(place(moving(2), "red", 0, 1), "red", 1, 10);
    expect(chooseMove(state, "hard", 123)).toEqual(chooseMove(state, "hard", 123));
  });

  it("returns the next seed, so a turn's noise keeps moving forward", () => {
    const state = place(moving(2), "red", 0, 1);
    expect(chooseMove(state, "hard", 5).seed).not.toBe(5);
  });
});

describe("stepAi", () => {
  it("leaves a human seat alone", () => {
    const state = place(moving(6), "red", 1, 10);
    const result = stepAi(state, { green: "hard" }, 1);
    expect(result.state).toBe(state);
    expect(result.seed).toBe(1);
  });

  it("rolls for an AI seat that is waiting to roll", () => {
    const state = { ...createGame(1, { colours: ["red", "green"] }), current: 1 };
    const result = stepAi(state, { green: "normal" }, 1);
    expect(result.state).not.toBe(state);
    expect(result.state.seed).not.toBe(state.seed);
  });

  it("moves for an AI seat that is waiting to move, and keeps the extra roll after a six", () => {
    const state = { ...moving(6, ["red", "green"]), current: 1 };
    const result = stepAi(state, { green: "normal" }, 1);
    expect(result.state.players[1]!.tokens[0]!.progress).toBe(0);
    expect(result.state.current).toBe(1);
    expect(result.state.phase).toBe("roll");
  });

  it("does nothing once the game is over", () => {
    const state = { ...moving(6), phase: "over" as const, winner: "red" as const };
    expect(stepAi(state, { red: "hard" }, 1).state).toBe(state);
  });
});
