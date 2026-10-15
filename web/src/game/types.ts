/** The four colours, in turn order. */
export type Colour = "red" | "green" | "yellow" | "blue";

/**
 * One token. `progress` counts steps along its own path from its start square:
 * YARD (-1) is off the board, 0–51 is the main track, 52–56 is the home column,
 * and FINISH (57) is the home triangle.
 */
export interface Token {
  index: number;
  progress: number;
}

export interface Player {
  colour: Colour;
  tokens: Token[];
}

export interface Rules {
  /** Three sixes in a row forfeit the turn; the third six does not move. */
  threeSixesForfeit: boolean;
  /** 2v2: seats 1 & 3 play as one team against seats 2 & 4. The team wins when all its tokens are home. */
  teamMode: boolean;
}

/** Teams are by seat: seats 1 & 3 are team A, seats 2 & 4 are team B. */
export type TeamId = "team-A" | "team-B";

/** Who won: a single colour, or a team in team mode. */
export type Winner = Colour | TeamId;

export type Phase = "roll" | "move" | "over";

/** Serialisable: plain data only, so a state can be stored or sent as JSON. */
export interface GameState {
  players: Player[];
  /** Index into `players` of whoever is to act. */
  current: number;
  /** `roll` waits for a roll, `move` waits for a token choice, `over` ends the game. */
  phase: Phase;
  /** The pending roll while `phase` is `move`, otherwise null. */
  die: number | null;
  /** Consecutive sixes rolled by the current player in this turn. */
  sixesInRow: number;
  /** Turns completed so far. Feeds the leaderboard score: fewer turns to win scores higher. */
  turns: number;
  /** Seed for the die. `applyMove` stores the next seed after each roll. */
  seed: number;
  rules: Rules;
  winner: Winner | null;
}

export type Move = { type: "roll" } | { type: "move"; colour: Colour; index: number };
