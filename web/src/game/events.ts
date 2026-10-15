import { FINISH, YARD } from "./engine";
import type { GameState } from "./types";

/** What happened in one step of a game, for sound. */
export type GameEvent = "roll" | "hop" | "capture" | "home" | "over";

/**
 * The sound-worthy events between two consecutive states. A roll changes the die
 * seed, a token moving on the board is a hop, a token sent back to its yard is a
 * capture, a token reaching the triangle is a home, and a finished game is over.
 * Pure, so the mapping can be tested without audio.
 */
export function gameEvents(prev: GameState, next: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  if (next.seed !== prev.seed) events.push("roll");

  let hop = false;
  let capture = false;
  let home = false;
  next.players.forEach((player, seat) => {
    const before = prev.players[seat];
    if (!before) return;
    player.tokens.forEach((token, i) => {
      const was = before.tokens[i]?.progress;
      if (was === undefined || was === token.progress) return;
      if (token.progress === YARD) capture = true;
      else if (token.progress === FINISH) home = true;
      else hop = true;
    });
  });
  if (hop) events.push("hop");
  if (capture) events.push("capture");
  if (home) events.push("home");
  if (next.phase === "over" && prev.phase !== "over") events.push("over");
  return events;
}
