import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGame } from "./engine";
import { GAME_ID, qualifiesForLeaderboard, SCORES_URL, submitWinScore, winScore } from "./leaderboard";
import { DEFAULT_OPTIONS, type GameOptions } from "./options";
import type { GameState, Winner } from "./types";

/** A finished game with `winner`. */
function finished(winner: Winner, turns = 40): GameState {
  return { ...createGame(1), phase: "over", winner, turns };
}

const allHard: GameOptions = {
  ...DEFAULT_OPTIONS,
  numSeats: 4,
  seats: [{ type: "human" }, { type: "ai", difficulty: "hard" }, { type: "ai", difficulty: "hard" }, { type: "ai", difficulty: "hard" }],
};

describe("winScore", () => {
  it("scores fewer turns higher", () => {
    expect(winScore(20)).toBeGreaterThan(winScore(40));
  });

  it("never drops below 1", () => {
    expect(winScore(10_000)).toBe(1);
  });
});

describe("qualifiesForLeaderboard", () => {
  it("counts a human win when every AI is Hard", () => {
    expect(qualifiesForLeaderboard(finished("red"), allHard)).toBe(true);
  });

  it("does not count when any AI is below Hard", () => {
    const mixed: GameOptions = {
      ...allHard,
      seats: [{ type: "human" }, { type: "ai", difficulty: "normal" }, { type: "ai", difficulty: "hard" }, { type: "ai", difficulty: "hard" }],
    };
    expect(qualifiesForLeaderboard(finished("red"), mixed)).toBe(false);
  });

  it("does not count a game with no AI opponents", () => {
    expect(qualifiesForLeaderboard(finished("red"), DEFAULT_OPTIONS)).toBe(false);
  });

  it("does not count when an AI wins", () => {
    expect(qualifiesForLeaderboard(finished("green"), allHard)).toBe(false);
  });

  it("does not count an unfinished game", () => {
    const playing = { ...finished("red"), phase: "roll" as const, winner: null };
    expect(qualifiesForLeaderboard(playing, allHard)).toBe(false);
  });

  it("counts a team win when the team includes a human", () => {
    const teams: GameOptions = { ...allHard, teamMode: true };
    // Seats 1 & 3 (red, yellow) are team A and include the human at seat 1.
    expect(qualifiesForLeaderboard(finished("team-A"), teams)).toBe(true);
  });

  it("does not count a team win made only of AI seats", () => {
    const teams: GameOptions = { ...allHard, teamMode: true };
    // Seats 2 & 4 (green, blue) are both AI.
    expect(qualifiesForLeaderboard(finished("team-B"), teams)).toBe(false);
  });
});

describe("submitWinScore", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts the score for this game", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await submitWinScore(900);
    expect(fetchMock).toHaveBeenCalledWith(
      SCORES_URL,
      expect.objectContaining({ method: "POST", body: JSON.stringify({ game: GAME_ID, score: 900 }) }),
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("logs an Invalid game reply without throwing", async () => {
    fetchMock.mockResolvedValue(new Response("Invalid game", { status: 400 }));
    await expect(submitWinScore(900)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("Invalid game"));
  });

  it("logs a network failure without throwing", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    await expect(submitWinScore(900)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it("does not post a score that is not a positive whole number", async () => {
    await submitWinScore(0);
    await submitWinScore(2.5);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
