import type { Colour, GameState, Move, Player, Rules, Token } from "./types";

export const COLOURS: readonly Colour[] = ["red", "green", "yellow", "blue"];
export const TOKENS_PER_PLAYER = 4;

/** Progress for a token in the yard, off the board. */
export const YARD = -1;
/** Last progress on the shared main track. The next step turns into the home column. */
export const MAIN_LAST = 51;
/** First home-column square. Opponents never reach these. */
export const HOME_FIRST = 52;
/** The home triangle. A token reaches it only with an exact roll. */
export const FINISH = 57;

/** The main track has 52 squares, numbered clockwise from red's start. */
export const TRACK_LENGTH = 52;

const START_CELL: Record<Colour, number> = { red: 0, green: 13, yellow: 26, blue: 39 };

/** Safe squares: each colour's start square, plus the star 8 squares after it. Tokens here cannot be captured. */
export const SAFE_CELLS: ReadonlySet<number> = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const DEFAULT_RULES: Rules = { threeSixesForfeit: true };

/** Seed used if a caller passes 0, since xorshift32 gets stuck on zero. */
const FALLBACK_SEED = 0x9e3779b9;

/**
 * Main-track square a token of `colour` stands on at `progress`, or null when the
 * token is in the yard, in the home column, or finished.
 */
export function trackCell(colour: Colour, progress: number): number | null {
  if (progress < 0 || progress > MAIN_LAST) return null;
  return (START_CELL[colour] + progress) % TRACK_LENGTH;
}

/**
 * Advance a seeded xorshift32 generator and return a die face 1–6. Pure: the same
 * seed always gives the same value, and the caller stores `nextSeed` for the next roll.
 */
export function rollDie(seed: number): { value: number; nextSeed: number } {
  let x = seed >>> 0 || FALLBACK_SEED;
  x = (x ^ (x << 13)) >>> 0;
  x = (x ^ (x >>> 17)) >>> 0;
  x = (x ^ (x << 5)) >>> 0;
  return { value: (x % 6) + 1, nextSeed: x };
}

export interface CreateGameOptions {
  /** Colours taking part, in turn order. Defaults to all four. */
  colours?: readonly Colour[];
  rules?: Partial<Rules>;
}

/** A new game: every token in its yard, and the first player to roll. */
export function createGame(seed: number, options: CreateGameOptions = {}): GameState {
  const colours = options.colours ?? COLOURS;
  if (colours.length < 2) throw new Error("A game needs at least two colours");
  const players: Player[] = colours.map((colour) => ({
    colour,
    tokens: Array.from({ length: TOKENS_PER_PLAYER }, (_, index): Token => ({ index, progress: YARD })),
  }));
  return {
    players,
    current: 0,
    phase: "roll",
    die: null,
    sixesInRow: 0,
    seed,
    rules: { ...DEFAULT_RULES, ...options.rules },
    winner: null,
  };
}

/** Whether `token` can move by `die`. A six brings a token out of the yard; otherwise the roll must not overshoot the finish. */
export function canMove(token: Token, die: number): boolean {
  if (token.progress === FINISH) return false;
  if (token.progress === YARD) return die === 6;
  return token.progress + die <= FINISH;
}

/** Every legal move for the pending roll. Empty unless the game is waiting for a token choice. */
export function legalMoves(state: GameState): Move[] {
  const die = state.die;
  const player = state.players[state.current];
  if (state.phase !== "move" || die === null || !player) return [];
  return player.tokens
    .filter((token) => canMove(token, die))
    .map((token) => ({ type: "move", colour: player.colour, index: token.index }));
}

/**
 * Apply one action and return the next state. The input is never changed.
 * Throws on an action that is not legal in the current phase.
 */
export function applyMove(state: GameState, move: Move): GameState {
  if (state.phase === "over") throw new Error("The game is over");
  if (move.type === "roll") {
    if (state.phase !== "roll") throw new Error("Not time to roll");
    return roll(state);
  }
  if (state.phase !== "move") throw new Error("Not time to move a token");
  return moveToken(state, move);
}

function roll(state: GameState): GameState {
  const { value, nextSeed } = rollDie(state.seed);
  const sixesInRow = value === 6 ? state.sixesInRow + 1 : 0;
  const rolled: GameState = { ...state, seed: nextSeed, die: null, sixesInRow };

  if (value === 6 && state.rules.threeSixesForfeit && sixesInRow === 3) {
    return endTurn({ ...rolled, sixesInRow: 0 });
  }

  const player = state.players[state.current];
  const canPlay = player !== undefined && player.tokens.some((token) => canMove(token, value));
  if (!canPlay) {
    // A six still earns another roll even when no token can use it.
    return value === 6 ? rolled : endTurn(rolled);
  }
  return { ...rolled, phase: "move", die: value };
}

function moveToken(state: GameState, move: Extract<Move, { type: "move" }>): GameState {
  const die = state.die;
  if (die === null) throw new Error("No roll to move with");
  const mover = state.players[state.current];
  if (!mover || mover.colour !== move.colour) throw new Error(`It is not ${move.colour}'s turn`);
  const token = mover.tokens.find((t) => t.index === move.index);
  if (!token) throw new Error(`No ${move.colour} token ${move.index}`);
  if (!canMove(token, die)) throw new Error(`Token ${move.index} cannot move ${die}`);

  const progress = token.progress === YARD ? 0 : token.progress + die;
  const cell = trackCell(move.colour, progress);
  // Landing on a shared, non-safe main-track square sends opponents there back to their yards.
  const captureCell = cell !== null && !SAFE_CELLS.has(cell) ? cell : null;

  const players = state.players.map((player): Player => ({
    ...player,
    tokens: player.tokens.map((t): Token => {
      if (player.colour === move.colour && t.index === move.index) return { ...t, progress };
      if (captureCell !== null && player.colour !== move.colour && trackCell(player.colour, t.progress) === captureCell) {
        return { ...t, progress: YARD };
      }
      return t;
    }),
  }));

  const moved: GameState = { ...state, players, die: null, phase: "roll" };
  const mine = players[state.current]!;
  if (mine.tokens.every((t) => t.progress === FINISH)) {
    return { ...moved, phase: "over", winner: move.colour };
  }
  // A six earns another roll; the sixes streak carries over.
  return die === 6 ? moved : endTurn(moved);
}

function endTurn(state: GameState): GameState {
  return { ...state, current: (state.current + 1) % state.players.length, die: null, phase: "roll", sixesInRow: 0 };
}
