import { teamOf } from "./engine";
import { buildSeats, type GameOptions } from "./options";
import type { GameState } from "./types";

export const GAME_ID = "rollway-ludo";

// Same endpoint the @freegamestore/games SDK posts to.
export const SCORES_URL = "https://leaderboard.freegamestore.online/v1/api/scores";

const WIN_BASE = 1000;

/** The score for a win: fewer turns scores higher, and every win scores at least 1. */
export function winScore(turns: number): number {
  return Math.max(1, WIN_BASE - turns);
}

/**
 * Whether a finished game is a leaderboard win. It needs at least one AI opponent,
 * every AI set to Hard, and a winning side that includes a human seat.
 */
export function qualifiesForLeaderboard(state: GameState, opts: GameOptions): boolean {
  if (state.phase !== "over" || state.winner === null) return false;
  const seats = buildSeats(opts);
  const difficulties = Object.values(seats);
  if (difficulties.length === 0 || difficulties.some((d) => d !== "hard")) return false;

  const winner = state.winner;
  const isHuman = (colour: string) => seats[colour as keyof typeof seats] === undefined;
  if (winner === "team-A" || winner === "team-B") {
    return state.players.some((p, seat) => teamOf(seat) === winner && isHuman(p.colour));
  }
  return isHuman(winner);
}

/**
 * Submits a win score. Never throws, and nothing reaches the player: failures are
 * logged, including "Invalid game", which the API returns for an unknown game id.
 */
export async function submitWinScore(score: number): Promise<void> {
  if (!Number.isInteger(score) || score < 1) return;
  try {
    const res = await fetch(SCORES_URL, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game: GAME_ID, score }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(`leaderboard submit failed (${res.status}): ${detail.slice(0, 200)}`);
    }
  } catch (err) {
    console.warn("leaderboard submit failed:", err);
  }
}
