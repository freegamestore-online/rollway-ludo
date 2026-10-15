// Copyright (c) 2026 FreeGameStore. MIT License, see LICENSE.
import { FINISH, YARD } from "./engine";

export interface HopStep {
  /** Where the token is drawn after this step. */
  progress: number;
  /** True when the token was sent back to its yard, so it should knock back. */
  kicked: boolean;
}

/**
 * One animation step for a token drawn at `from` on its way to `to`. Forward
 * moves advance one square at a time, a token leaving the yard appears on its
 * start square, and a capture jumps back to the yard with a knock. With reduced
 * motion the token goes straight to `to`. Pure, so the sequence can be tested.
 */
export function stepProgress(from: number, to: number, reduced: boolean): HopStep {
  if (from === to) return { progress: from, kicked: false };
  if (to === YARD) return { progress: YARD, kicked: from !== YARD };
  if (reduced) return { progress: to, kicked: false };
  if (from === YARD) return { progress: 0, kicked: false };
  return { progress: Math.min(from + 1, FINISH), kicked: false };
}
