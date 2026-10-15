import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Board from "./Board";
import Die from "./Die";
import { applyMove, createGame, FINISH, YARD } from "./game/engine";
import type { GameState, Token } from "./game/types";

function withToken(state: GameState, colour: string, index: number, progress: number): GameState {
  return {
    ...state,
    players: state.players.map((p) =>
      p.colour !== colour
        ? p
        : { ...p, tokens: p.tokens.map((t): Token => (t.index === index ? { ...t, progress } : t)) },
    ),
  };
}

describe("Board", () => {
  it("names every token by colour, number and place, not by colour alone", () => {
    const state = withToken(createGame(1), "red", 0, FINISH);
    const { container } = render(<Board players={state.players} />);
    const titles = Array.from(container.querySelectorAll("title")).map((t) => t.textContent);
    expect(titles).toHaveLength(16);
    expect(titles).toContain("Red token 1, home");
    expect(titles).toContain("Green token 2, in the yard");
  });

  it("labels each token with its number", () => {
    const { container } = render(<Board players={createGame(1).players} />);
    const numbers = Array.from(container.querySelectorAll("text")).map((t) => t.textContent);
    expect(numbers.filter((n) => n === "1")).toHaveLength(4);
  });

  it("draws a token that has left the yard on the track", () => {
    const state = applyMove({ ...createGame(1), phase: "move", die: 6 }, { type: "move", colour: "red", index: 0 });
    expect(state.players[0]!.tokens[0]!.progress).not.toBe(YARD);
    const { container } = render(<Board players={state.players} />);
    expect(container.querySelector("title")?.textContent).toBe("Red token 1");
  });
});

describe("Die", () => {
  it("reads its value out to screen readers", () => {
    render(<Die value={5} />);
    expect(screen.getByRole("img", { name: "Die shows 5" })).toBeTruthy();
  });

  it("says when it has not been rolled", () => {
    render(<Die value={null} />);
    expect(screen.getByRole("img", { name: "Die, not rolled" })).toBeTruthy();
  });
});
