import { useEffect, useMemo, useRef, useState } from "react";
import { GameButton, useGameSounds } from "@freegamestore/games";
import { stepAi } from "./game/ai";
import { FINISH, applyMove, legalMoves, resolveAutoMove } from "./game/engine";
import { gameEvents, type GameEvent } from "./game/events";
import { clearGame, saveGame, type SavedGame } from "./game/save";
import { buildSeats } from "./game/options";
import { qualifiesForLeaderboard, submitWinScore, winScore } from "./game/leaderboard";
import type { Colour, GameState, Move, Winner } from "./game/types";
import Board from "./Board";
import Die from "./Die";

/** Pause between AI actions, so a player can follow what happened. */
const AI_DELAY_MS = 600;

const COLOUR_NAMES: Record<Colour, string> = { red: "Red", green: "Green", yellow: "Yellow", blue: "Blue" };

interface MatchProps {
  /** The game to play: a fresh one, or a save being resumed. */
  start: SavedGame;
  /** Open the menu, to change options or see the leaderboard. */
  onMenu: () => void;
  /** Begin another game with the same options. */
  onRestart: () => void;
}

/**
 * One game. AI seats play on a timer, and auto-move applies a lone legal move at
 * once. Human seats use the buttons below the board. Every change is saved, so a
 * reload resumes here, and a finished game clears its save and may post a win.
 */
export default function Match({ start, onMenu, onRestart }: MatchProps) {
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
    <div className="flex flex-col items-center gap-2 w-full h-full min-h-0 max-w-md">
      <p className="text-base font-semibold" role="status">
        {statusText(game, currentDifficulty)}
      </p>

      <div className="w-full max-w-88 aspect-square min-h-0">
        <Board players={game.players} />
      </div>

      <div className="flex flex-col items-center gap-2 w-full">
        {/* Keyed by the seed, so every roll replays the tumble. */}
        <Die key={game.seed} value={game.die} />
        <ul className="grid grid-cols-2 gap-2 w-full max-w-88 text-sm">
          {game.players.map((player, seat) => (
            <li key={player.colour} className="rounded-lg px-3 py-2 bg-[var(--panel)] text-[var(--ink)]">
              {seat + 1} {COLOUR_NAMES[player.colour]}
              {seats[player.colour] ? ` · AI ${seats[player.colour]}` : ""}
              <span className="block text-[var(--muted)]">{player.tokens.filter((t) => t.progress === FINISH).length} of 4 home</span>
            </li>
          ))}
        </ul>
      </div>

      {humanCanRoll && (
        <GameButton size="lg" onClick={() => act({ type: "roll" })}>
          Roll
        </GameButton>
      )}

      {humanCanMove && (
        <div className="flex flex-wrap justify-center gap-2">
          {moves.map((move) =>
            move.type === "move" ? (
              <GameButton key={move.index} onClick={() => act(move)}>
                Move token {move.index + 1}
              </GameButton>
            ) : null,
          )}
        </div>
      )}

      {game.phase === "over" && <GameButton onClick={onRestart}>Play again</GameButton>}

      <GameButton variant="ghost" size="sm" onClick={onMenu}>
        Menu
      </GameButton>
    </div>
  );
}

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
  if (game.phase === "roll") return `${who} to roll`;
  return `${who} rolled ${game.die}, to move`;
}

function winnerName(winner: Winner): string {
  if (winner === "team-A") return "Seats 1 & 3";
  if (winner === "team-B") return "Seats 2 & 4";
  return COLOUR_NAMES[winner];
}
