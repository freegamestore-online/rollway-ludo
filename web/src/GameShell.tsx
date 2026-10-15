import { useState } from "react";
import { GameShell as PlatformShell, GameThemeToggle, GameTopbar, GameAuth } from "@freegamestore/games";
import { ParticleLayer } from "./feel";
import Lobby from "./Lobby";
import LeaderboardView from "./LeaderboardView";
import Match from "./Match";
import { loadOptions, saveOptions, type GameOptions } from "./game/options";
import { clearGame, loadGame, newSavedGame, type SavedGame } from "./game/save";

type Screen = "playing" | "lobby" | "leaderboard";

/**
 * The game's frame: the platform shell with its theme toggle, and the board. The
 * board shows straight away: a saved game resumes, otherwise a new one starts. The
 * menu holds the options and the leaderboard.
 */
export default function GameShell() {
  const [opts, setOpts] = useState<GameOptions>(loadOptions);
  // The game on the board. Match saves every change, so loadGame() is always its latest state.
  const [active, setActive] = useState<SavedGame>(() => loadGame() ?? newSavedGame(loadOptions()));
  const [screen, setScreen] = useState<Screen>("playing");
  // Bumped on each new board, so every game gets a fresh Match.
  const [gameNo, setGameNo] = useState(0);
  const [saved, setSaved] = useState<SavedGame | null>(null);

  const play = (game: SavedGame) => {
    setActive(game);
    setGameNo((n) => n + 1);
    setScreen("playing");
  };

  const startNew = () => {
    saveOptions(opts);
    clearGame();
    play(newSavedGame(opts));
  };

  const openMenu = () => {
    setSaved(loadGame());
    setScreen("lobby");
  };

  const backToGame = () => {
    const game = loadGame();
    if (game) {
      setOpts(game.opts);
      play(game);
    }
  };

  return (
    <PlatformShell topbar={<GameTopbar title="Rollway Ludo" score={0} actions={<GameThemeToggle />} />}>
      <GameAuth />
      <div className="relative flex flex-col items-center justify-center h-full min-h-0 gap-2 p-3 overflow-hidden">
        {screen === "playing" && (
          <Match key={gameNo} start={active} onMenu={openMenu} onRestart={() => play(newSavedGame(active.opts))} />
        )}
        {screen === "lobby" && (
          <Lobby
            opts={opts}
            onChange={setOpts}
            onStart={startNew}
            onBack={saved ? backToGame : null}
            onLeaderboard={() => setScreen("leaderboard")}
          />
        )}
        {screen === "leaderboard" && <LeaderboardView onBack={() => setScreen("lobby")} />}
        <ParticleLayer />
      </div>
    </PlatformShell>
  );
}
