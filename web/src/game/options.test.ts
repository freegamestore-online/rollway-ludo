import { beforeEach, describe, expect, it } from "vitest";
import { applyMove, createGame, resolveAutoMove, rollDie, FINISH } from "./engine";
import {
  DEFAULT_OPTIONS,
  STORAGE_KEY,
  buildSeats,
  createGameFromOptions,
  effectiveTeamMode,
  engineConfig,
  loadOptions,
  sanitise,
  saveOptions,
  type GameOptions,
} from "./options";
import type { GameState, Token } from "./types";

beforeEach(() => {
  localStorage.clear();
});

/** The first seed whose die roll is `value`. */
function seedFor(value: number): number {
  for (let seed = 1; seed < 10_000; seed++) if (rollDie(seed).value === value) return seed;
  throw new Error(`no seed rolls ${value}`);
}

function withOptions(patch: Partial<GameOptions>): GameOptions {
  return { ...DEFAULT_OPTIONS, ...patch };
}

describe("saveOptions and loadOptions", () => {
  it("round-trips a full set of options", () => {
    const opts = withOptions({
      numSeats: 3,
      seats: [
        { type: "human" },
        { type: "ai", difficulty: "hard" },
        { type: "ai", difficulty: "easy" },
        { type: "human" },
      ],
      teamMode: true,
      threeSixesForfeit: false,
      autoMove: true,
    });
    saveOptions(opts);
    expect(loadOptions()).toEqual(opts);
  });

  it("writes to the rollway-options key", () => {
    saveOptions(DEFAULT_OPTIONS);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(DEFAULT_OPTIONS));
  });

  it("returns the defaults when nothing is saved", () => {
    expect(loadOptions()).toEqual(DEFAULT_OPTIONS);
  });

  it("returns the defaults for unparseable JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadOptions()).toEqual(DEFAULT_OPTIONS);
  });

  it("keeps valid fields and defaults the invalid ones", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ numSeats: 7, autoMove: true, teamMode: "yes" }));
    const loaded = loadOptions();
    expect(loaded.numSeats).toBe(DEFAULT_OPTIONS.numSeats);
    expect(loaded.autoMove).toBe(true);
    expect(loaded.teamMode).toBe(DEFAULT_OPTIONS.teamMode);
  });

  it("does not hand out the shared default objects", () => {
    const loaded = loadOptions();
    loaded.seats[0] = { type: "ai", difficulty: "hard" };
    expect(DEFAULT_OPTIONS.seats[0]).toEqual({ type: "human" });
  });
});

describe("sanitise", () => {
  it("turns an unknown difficulty into a human seat", () => {
    const opts = sanitise({ seats: [{ type: "ai", difficulty: "impossible" }, null, 3, { type: "ai", difficulty: "normal" }] });
    expect(opts.seats).toEqual([
      { type: "human" },
      { type: "human" },
      { type: "human" },
      { type: "ai", difficulty: "normal" },
    ]);
  });

  it("returns the defaults for something that is not an object", () => {
    expect(sanitise(null)).toEqual(DEFAULT_OPTIONS);
    expect(sanitise("nope")).toEqual(DEFAULT_OPTIONS);
  });
});

describe("seats", () => {
  it("only builds AI entries for the seats in play", () => {
    const opts = withOptions({
      numSeats: 2,
      seats: [
        { type: "human" },
        { type: "ai", difficulty: "normal" },
        { type: "ai", difficulty: "hard" },
        { type: "ai", difficulty: "easy" },
      ],
    });
    expect(buildSeats(opts)).toEqual({ green: "normal" });
  });

  it("maps seats to colours in turn order", () => {
    const opts = withOptions({
      seats: [
        { type: "ai", difficulty: "easy" },
        { type: "human" },
        { type: "ai", difficulty: "hard" },
        { type: "human" },
      ],
    });
    expect(buildSeats(opts)).toEqual({ red: "easy", yellow: "hard" });
  });

  it("creates a game with one player per seat in play", () => {
    expect(createGameFromOptions(1, withOptions({ numSeats: 3 })).players.map((p) => p.colour)).toEqual([
      "red",
      "green",
      "yellow",
    ]);
  });
});

describe("team mode option", () => {
  it("applies only with four seats", () => {
    expect(effectiveTeamMode(withOptions({ numSeats: 4, teamMode: true }))).toBe(true);
    expect(effectiveTeamMode(withOptions({ numSeats: 3, teamMode: true }))).toBe(false);
    expect(effectiveTeamMode(withOptions({ numSeats: 2, teamMode: true }))).toBe(false);
  });

  it("reaches the engine rules", () => {
    expect(createGameFromOptions(1, withOptions({ teamMode: true })).rules.teamMode).toBe(true);
    expect(createGameFromOptions(1, withOptions({ numSeats: 2, teamMode: true })).rules.teamMode).toBe(false);
    expect(engineConfig(withOptions({ teamMode: false })).rules.teamMode).toBe(false);
  });
});

describe("three-6s toggle", () => {
  /** A game where red has already rolled two sixes, so the next six is the third. */
  function afterTwoSixes(opts: GameOptions): GameState {
    const state = createGameFromOptions(seedFor(6), opts);
    return { ...state, sixesInRow: 2 };
  }

  it("forfeits the turn on a third six when on", () => {
    const next = applyMove(afterTwoSixes(withOptions({ threeSixesForfeit: true })), { type: "roll" });
    expect(next.current).toBe(1);
    expect(next.players[0]!.tokens.every((t: Token) => t.progress === -1)).toBe(true);
  });

  it("lets the third six move a token when off", () => {
    const state = { ...afterTwoSixes(withOptions({ threeSixesForfeit: false })) };
    const rolled = applyMove(state, { type: "roll" });
    expect(rolled.phase).toBe("move");
    expect(rolled.current).toBe(0);
    expect(rolled.sixesInRow).toBe(3);
  });
});

describe("auto-move", () => {
  /** Red at progress 10 is the only token that can move a roll of 3. */
  function onlyOneChoice(): GameState {
    const state = createGame(1);
    const players = state.players.map((p) =>
      p.colour !== "red"
        ? p
        : { ...p, tokens: p.tokens.map((t) => (t.index === 2 ? { ...t, progress: 10 } : t)) },
    );
    return { ...state, players, phase: "move", die: 3 };
  }

  it("moves straight away when auto-move is on and only one move is legal", () => {
    const next = resolveAutoMove(onlyOneChoice(), withOptions({ autoMove: true }).autoMove);
    const token = next.players[0]!.tokens.find((t) => t.index === 2)!;
    expect(token.progress).toBe(13);
    expect(next.phase).toBe("roll");
  });

  it("waits for a tap when auto-move is off", () => {
    const state = onlyOneChoice();
    expect(resolveAutoMove(state, withOptions({ autoMove: false }).autoMove)).toBe(state);
  });

  it("does not auto-move when several moves are legal", () => {
    const state = onlyOneChoice();
    const crowded = {
      ...state,
      players: state.players.map((p) =>
        p.colour !== "red" ? p : { ...p, tokens: p.tokens.map((t) => (t.index === 0 ? { ...t, progress: 30 } : t)) },
      ),
    };
    expect(resolveAutoMove(crowded, true)).toBe(crowded);
  });

  it("does not auto-move when a six gives several choices", () => {
    const state = onlyOneChoice();
    const near = {
      ...state,
      die: 6,
      players: state.players.map((p) =>
        p.colour !== "red" ? p : { ...p, tokens: p.tokens.map((t) => (t.index === 2 ? { ...t, progress: FINISH - 1 } : t)) },
      ),
    };
    // A six lets the yard tokens out as well, so there are several choices and nothing is automatic.
    expect(resolveAutoMove(near, true)).toBe(near);
  });
});
