import { useEffect, useMemo, useRef, useState } from "react";
import { useGameSounds } from "@freegamestore/games";
import { stepAi } from "./game/ai";
import { FINISH, HOME_FIRST, YARD, applyMove, legalMoves, resolveAutoMove, } from "./game/engine";
import { gameEvents, type GameEvent } from "./game/events";
import { clearGame, saveGame, type SavedGame } from "./game/save";
import { buildSeats } from "./game/options";
import { qualifiesForLeaderboard, submitWinScore, winScore } from "./game/leaderboard";
import type { GameState, Move, Winner } from "./game/types";

/** Pause between AI actions, so a player can follow what happened. */
const AI_DELAY_MS = 600;

const COLOUR_NAMES: Record<string, string> = { red: "Red", green: "Green", yellow: "Yellow", blue: "Blue" };

interface MatchProps {
  /** The game to play: a fresh one, or a save being resumed. */
  start: SavedGame;
  onQuit: () => void;
}

/**
 * One game. AI seats play on a timer, and auto-move applies a lone legal move at
 * once. Human seats use the buttons below. Every change is saved, so a reload
 * resumes here, and a finished game clears its save and may post a leaderboard win.
 */
export default function Match({ start, onQuit }: MatchProps) {
  const opts = start.opts;
  const seats = useMemo(() => buildSeats(opts), [opts]);
  const [session, setSession] = useState(() => ({ game: start.state, aiSeed: start.aiSeed }));
  const { game, aiSeed } = session;
  const current = game.players[game.current];
  const currentDifficulty = current ? seats[current.colour] : undefined;
  const aiTurn = currentDifficulty !== undefined;
  const sounds = useGameSounds();
  const lastGame = useRef(game);
  const submitted = useRef(false);

  // Save after every change. A finished game has nothing to resume, so its save goes.
  useEffect(() => {
    if (game.phase === "over") clearGame();
    else saveGame({ version: 1, state: game, aiSeed, opts });
  }, [game, aiSeed, opts]);

  // Sound for each event in the step that just happened.
  useEffect(() => {
    const prev = lastGame.current;
    lastGame.current = game;
    if (prev === game) return;
    for (const event of gameEvents(prev, game)) SOUND_FOR[event](sounds);
  }, [game, sounds]);

  // Post a win once. Only qualifying games are sent, and failures stay out of the UI.
  useEffect(() => {
    if (submitted.current || game.phase !== "over" || !qualifiesForLeaderboard(game, opts)) return;
    submitted.current = true;
    void submitWinScore(winScore(game.turns));
  }, [game, opts]);

  useEffect(() => {
    if (!aiTurn || game.phase === "over") return;
    const timer = window.setTimeout(() => {
      setSession((s) => {
        const step = stepAi(s.game, seats, s.aiSeed);
        return { game: resolveAutoMove(step.state, opts.autoMove), aiSeed: step.seed };
      });
    }, AI_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [game, aiTurn, seats, opts]);

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

type Sounds = ReturnType<typeof useGameSounds>;

/** Which sound plays for each event. */
const SOUND_FOR: Record<GameEvent, (sounds: Sounds) => void> = {
  roll: (s) => s.playTick(),
  hop: (s) => s.playMove(),
  capture: (s) => s.playDrop(),
  home: (s) => s.playLevelUp(),
  over: (s) => s.playGameOver(),
};

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
