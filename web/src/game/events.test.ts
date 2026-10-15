import { describe, expect, it } from "vitest";
import { applyMove, createGame, FINISH, YARD } from "./engine";
import { gameEvents } from "./events";
import type { GameState, Token } from "./types";

function place(state: GameState, colour: string, index: number, progress: number): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.colour !== colour
        ? p
        : { ...p, tokens: p.tokens.map((t): Token => (t.index === index ? { ...t, progress } : t)) },
    ),
  };
}

describe("gameEvents", () => {
  it("reports nothing when the state did not change", () => {
    const state = createGame(1);
    expect(gameEvents(state, state)).toEqual([]);
  });

  it("reports a roll when the die seed advances", () => {
    const before = createGame(1);
    expect(gameEvents(before, applyMove(before, { type: "roll" }))).toContain("roll");
  });

  it("reports a hop when a token moves on the board", () => {
    const before = { ...place(createGame(1), "red", 0, 4), phase: "move" as const, die: 2 };
    const after = applyMove(before, { type: "move", colour: "red", index: 0 });
    expect(gameEvents(before, after)).toEqual(["hop"]);
  });

  it("reports a hop when a token leaves the yard", () => {
    const before = { ...createGame(1), phase: "move" as const, die: 6 };
    const after = applyMove(before, { type: "move", colour: "red", index: 0 });
    expect(gameEvents(before, after)).toEqual(["hop"]);
  });

  it("reports a capture when an opponent is sent to the yard", () => {
    // Red goes from progress 1 to 3, landing on green's token at progress 42 (cell 3).
    const before = { ...place(place(createGame(1), "red", 0, 1), "green", 0, 42), phase: "move" as const, die: 2 };
    const after = applyMove(before, { type: "move", colour: "red", index: 0 });
    expect(gameEvents(before, after)).toContain("capture");
    expect(after.players[1]!.tokens[0]!.progress).toBe(YARD);
  });

  it("reports a home when a token reaches the finish", () => {
    const before = { ...place(createGame(1), "red", 0, FINISH - 2), phase: "move" as const, die: 2 };
    const after = applyMove(before, { type: "move", colour: "red", index: 0 });
    expect(gameEvents(before, after)).toContain("home");
    expect(gameEvents(before, after)).not.toContain("hop");
  });

  it("reports the end of the game", () => {
    let before = createGame(1);
    for (let i = 1; i < 4; i++) before = place(before, "red", i, FINISH);
    before = { ...place(before, "red", 0, FINISH - 1), phase: "move", die: 1 };
    const after = applyMove(before, { type: "move", colour: "red", index: 0 });
    expect(gameEvents(before, after)).toContain("over");
  });
});
