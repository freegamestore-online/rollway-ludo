import {
  FINISH,
  HOME_FIRST,
  MAIN_LAST,
  SAFE_CELLS,
  START_CELL,
  TRACK_LENGTH,
  YARD,
  advanceSeed,
  applyMove,
  legalMoves,
  trackCell,
} from "./engine";
import type { Colour, GameState, Move, Token } from "./types";

export type Difficulty = "easy" | "normal" | "hard";

/** Which seats are AI, and at what difficulty. Seats not listed are human. */
export type Seats = Partial<Record<Colour, Difficulty>>;

/** Score for leaving the yard. Worth about one six of progress. */
const YARD_EXIT = 6;
/** Base score for sending an opponent to the yard, plus that opponent's progress. */
const CAPTURE = 20;
const FINISH_BONUS = 20;
/** Hard: landing on a safe square or in the home column. */
const SAFE_BONUS = 6;
/** Hard: score per own token rescued from, or exposed to, an opponent's reach. */
const THREAT_WEIGHT = 8;
/** Hard: extra penalty for exposing a token while not ahead on progress. */
const RISK_PENALTY = 6;
/**
 * Hard: random tie-break, kept below 1. Base scores are whole numbers, so this
 * only reorders moves that score the same, and never overrules a real difference.
 */
const NOISE = 0.9;

export interface AiChoice {
  move: Move;
  /** Seed after this choice, to pass to the next one. */
  seed: number;
}

/**
 * The AI's move for the pending roll. Easy picks any legal move at random. Normal
 * scores progress, captures and finishes. Hard adds safety and risk, plus a small
 * seeded tie-break. Ties go to the lowest token index, so normal is fully deterministic.
 * Pure: the same state and seed always give the same choice.
 */
export function chooseMove(state: GameState, difficulty: Difficulty, seed: number): AiChoice {
  const moves = legalMoves(state);
  if (moves.length === 0) throw new Error("No legal moves to choose from");

  if (difficulty === "easy") {
    const next = advanceSeed(seed);
    return { move: moves[next % moves.length]!, seed: next };
  }

  let best = moves[0]!;
  let bestScore = -Infinity;
  let next = seed;
  for (const move of moves) {
    if (move.type !== "move") continue;
    let score = evaluate(state, move, difficulty);
    if (difficulty === "hard") {
      next = advanceSeed(next);
      score += (next / 2 ** 32) * NOISE;
    }
    if (score > bestScore) {
      best = move;
      bestScore = score;
    }
  }
  return { move: best, seed: next };
}

/**
 * Take one AI step if the player to act is an AI seat: roll for them, or move
 * their token. Human seats, and games that are over, come back unchanged. Call it
 * repeatedly, once per frame or tick, until the next seat is human.
 */
export function stepAi(state: GameState, seats: Seats, seed: number): { state: GameState; seed: number } {
  if (state.phase === "over") return { state, seed };
  const colour = state.players[state.current]?.colour;
  const difficulty = colour ? seats[colour] : undefined;
  if (!difficulty) return { state, seed };

  if (state.phase === "roll") return { state: applyMove(state, { type: "roll" }), seed };
  const choice = chooseMove(state, difficulty, seed);
  return { state: applyMove(state, choice.move), seed: choice.seed };
}

function evaluate(state: GameState, move: Extract<Move, { type: "move" }>, difficulty: Difficulty): number {
  const after = applyMove(state, move);
  const mover = state.players[state.current]!;
  const before = findToken(state, mover.colour, move.index);
  const landed = findToken(after, mover.colour, move.index);

  let score = before.progress === YARD ? YARD_EXIT : landed.progress - before.progress;
  if (landed.progress === FINISH) score += FINISH_BONUS;

  for (const player of state.players) {
    if (player.colour === mover.colour) continue;
    for (const victim of player.tokens) {
      const sentHome = victim.progress !== YARD && findToken(after, player.colour, victim.index).progress === YARD;
      if (sentHome) score += CAPTURE + victim.progress;
    }
  }

  if (difficulty === "normal") return score;

  const cell = trackCell(mover.colour, landed.progress);
  if ((cell !== null && SAFE_CELLS.has(cell)) || landed.progress >= HOME_FIRST) score += SAFE_BONUS;

  const threatsBefore = threatenedCount(state, mover.colour);
  const threatsAfter = threatenedCount(after, mover.colour);
  score += (threatsBefore - threatsAfter) * THREAT_WEIGHT;
  if (threatsAfter > threatsBefore && !isAhead(state, mover.colour)) score -= RISK_PENALTY;

  return score;
}

function findToken(state: GameState, colour: Colour, index: number): Token {
  const token = state.players.find((p) => p.colour === colour)?.tokens.find((t) => t.index === index);
  if (!token) throw new Error(`No ${colour} token ${index}`);
  return token;
}

/** How many of `colour`'s tokens sit on an unsafe main-track square an opponent can reach next turn. */
function threatenedCount(state: GameState, colour: Colour): number {
  const mine = state.players.find((p) => p.colour === colour);
  if (!mine) return 0;
  let count = 0;
  for (const token of mine.tokens) {
    const cell = trackCell(colour, token.progress);
    if (cell === null || SAFE_CELLS.has(cell)) continue;
    if (isThreatened(state, colour, cell)) count++;
  }
  return count;
}

/** Whether an opponent token is 1–6 steps behind `cell`, so a single roll could land on it. */
function isThreatened(state: GameState, colour: Colour, cell: number): boolean {
  for (const player of state.players) {
    if (player.colour === colour) continue;
    const offset = (cell - START_CELL[player.colour] + TRACK_LENGTH) % TRACK_LENGTH;
    for (const token of player.tokens) {
      if (token.progress === YARD || token.progress > MAIN_LAST) continue;
      const gap = offset - token.progress;
      if (gap >= 1 && gap <= 6) return true;
    }
  }
  return false;
}

/** Whether `colour`'s total progress is more than the average of everyone else's. */
function isAhead(state: GameState, colour: Colour): boolean {
  const total = (c: Colour) =>
    (state.players.find((p) => p.colour === c)?.tokens ?? []).reduce((sum, t) => sum + Math.max(0, t.progress), 0);
  const others = state.players.filter((p) => p.colour !== colour);
  if (others.length === 0) return true;
  const average = others.reduce((sum, p) => sum + total(p.colour), 0) / others.length;
  return total(colour) > average;
}
