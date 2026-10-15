import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Match from "./Match";
import { DEFAULT_OPTIONS, type GameOptions } from "./game/options";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Match", () => {
  it("plays an all-AI game to a winner, with auto-move on", () => {
    const opts: GameOptions = {
      ...DEFAULT_OPTIONS,
      numSeats: 4,
      seats: [
        { type: "ai", difficulty: "hard" },
        { type: "ai", difficulty: "normal" },
        { type: "ai", difficulty: "easy" },
        { type: "ai", difficulty: "hard" },
      ],
      autoMove: true,
    };
    render(<Match opts={opts} onQuit={() => {}} />);

    // Each AI action waits 600ms. Advance until the game reports a winner, with a cap in case it never ends.
    for (let i = 0; i < 20_000 && !screen.queryByText(/wins!/); i++) {
      act(() => {
        vi.advanceTimersByTime(600);
      });
    }
    expect(screen.getByRole("status").textContent).toMatch(/wins!/);
  });

  it("shows the human's roll button and no AI moves while it is their turn", () => {
    render(<Match opts={DEFAULT_OPTIONS} onQuit={() => {}} />);
    expect(screen.getByRole("button", { name: "Roll" })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    // Human seats never act on a timer, so the status still waits on this seat.
    expect(screen.getByRole("status").textContent).toMatch(/Red to roll/);
  });
});
