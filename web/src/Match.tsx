import { useEffect, useMemo, useState } from "react";
import { stepAi } from "./game/ai";
import { FINISH, HOME_FIRST, YARD, applyMove, legalMoves, resolveAutoMove } from "./game/engine";
import { buildSeats, createGameFromOptions, type GameOptions } from "./game/options";
import type { GameState, Move, Winner } from "./game/types";

/** Pause between AI actions, so a player can follow what happened. */
const AI_DELAY_MS = 600;

const COLOUR_NAMES: Record<string, string> = { red: "Red", green: "Green", yellow: "Yellow", blue: "Blue" };

function newSeed(): number {
  return Math.floor(Math.random() * 0xfffffffe) + 1;
}

interface MatchProps {
  opts: GameOptions;
  onQuit: () => void;
}

/**
 * One game under the given options. AI seats play on a timer, and auto-move
 * applies a lone legal move straight away. Human seats use the buttons below.
 */
export default function Match({ opts, onQuit }: MatchProps) {
  const seats = useMemo(() => buildSeats(opts), [opts]);
  const [session, setSession] = useState(() => ({
    game: createGameFromOptions(newSeed(), opts),
    aiSeed: newSeed(),
  }));
  const { game } = session;
  const current = game.players[game.current];
  const currentDifficulty = current ? seats[current.colour] : undefined;
  const aiTurn = currentDifficulty !== undefined;

  useEffect(() => {
    if (!aiTurn || game.phase === "over") return;
    const timer = window.setTimeout(() => {
      setSession((s) => {
        const step = stepAi(s.game, seats, s.aiSeed);
        return { game: resolveAutoMove(step.state, opts.autoMove), aiSeed: step.seed };
      });
    }, AI_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [game, aiTurn, seats, opts.autoMove]);

  // Auto-move runs right after each action, so a lone legal move never waits for a tap.
  const act = (move: Move) =>
    setSession((s) => ({ ...s, game: resolveAutoMove(applyMove(s.game, move), opts.autoMove) }));
  const moves = legalMoves(game);
  const humanCanRoll = !aiTurn && game.phase === "roll";
  const humanCanMove = !aiTurn && game.phase === "move";

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md">
      <p className="text-lg font-semibold" role="status">
        {statusText(game, currentDifficulty)}
      </p>

      {game.phase === "move" && game.die !== null && (
        <p style={{ color: "var(--muted)" }}>Rolled a {game.die}</p>
      )}

      <ul className="w-full flex flex-col gap-2">
        {game.players.map((player, seat) => (
          <li key={player.colour} className="rounded p-3" style={{ background: "var(--panel)" }}>
            <p className="font-semibold">
              Seat {seat + 1}: {COLOUR_NAMES[player.colour]}
            </p>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {player.tokens.map((t) => describeProgress(t.progress)).join(" · ")}
            </p>
          </li>
        ))}
      </ul>

      {humanCanRoll && (
        <button className="rounded-full px-5 py-2 font-semibold" style={buttonStyle} onClick={() => act({ type: "roll" })}>
          Roll
        </button>
      )}

      {humanCanMove && (
        <div className="flex flex-wrap justify-center gap-2">
          {moves.map((move) =>
            move.type === "move" ? (
              <button
                key={move.index}
                className="rounded-full px-4 py-2 font-semibold"
                style={buttonStyle}
                onClick={() => act(move)}
              >
                Move token {move.index + 1}
              </button>
            ) : null,
          )}
        </div>
      )}

      <button className="rounded-full px-4 py-2 text-sm" style={{ border: "1px solid var(--line-strong)" }} onClick={onQuit}>
        {game.phase === "over" ? "Back to options" : "Quit to options"}
      </button>
    </div>
  );
}

const buttonStyle = { background: "var(--accent)", color: "#fff" };

function statusText(game: GameState, difficulty: string | undefined): string {
  if (game.phase === "over" && game.winner) return `${winnerName(game.winner)} wins!`;
  const player = game.players[game.current];
  if (!player) return "";
  const who = `${COLOUR_NAMES[player.colour]}${difficulty ? ` (AI ${difficulty})` : ""}`;
  return game.phase === "roll" ? `${who} to roll` : `${who} to move`;
}

function winnerName(winner: Winner): string {
  if (winner === "team-A") return "Seats 1 & 3";
  if (winner === "team-B") return "Seats 2 & 4";
  return COLOUR_NAMES[winner] ?? winner;
}

function describeProgress(progress: number): string {
  if (progress === YARD) return "yard";
  if (progress === FINISH) return "home";
  if (progress >= HOME_FIRST) return "home column";
  return `step ${progress}`;
}
