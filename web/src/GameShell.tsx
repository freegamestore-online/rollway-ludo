import { useState } from "react";
import { GameShell as PlatformShell, GameThemeToggle, GameTopbar, GameAuth } from "@freegamestore/games";
import { ParticleLayer } from "./feel";
import Lobby from "./Lobby";
import LeaderboardView from "./LeaderboardView";
import Match from "./Match";
import { loadOptions, saveOptions, type GameOptions } from "./game/options";
import { clearGame, loadGame, newSavedGame, type SavedGame } from "./game/save";

type Screen = "lobby" | "playing" | "leaderboard";

/**
 * The game's frame: the platform shell with its theme toggle, the title, and the
 * particle layer. Shows the lobby, a match, or the leaderboard. Options and any
 * unfinished game are restored from localStorage on load.
 */
export default function GameShell() {
  const [opts, setOpts] = useState<GameOptions>(loadOptions);
  const [saved, setSaved] = useState<SavedGame | null>(loadGame);
  const [screen, setScreen] = useState<Screen>("lobby");
  // The game being played, and a counter so each one gets a fresh Match.
  const [active, setActive] = useState<SavedGame | null>(null);
  const [gameNo, setGameNo] = useState(0);

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

  const resume = () => {
    if (!saved) return;
    setOpts(saved.opts);
    play(saved);
  };

  const quit = () => {
    setSaved(loadGame());
    setScreen("lobby");
  };

  return (
    <PlatformShell
      topbar={<GameTopbar title="Rollway Ludo" score={0} actions={<GameThemeToggle />} />}
    >
      <GameAuth />
      <div className="relative flex flex-col items-center justify-center h-full gap-4 p-4 overflow-y-auto">
        <h1 className="text-3xl font-bold" style={{ fontFamily: "Fraunces, serif" }}>
          Rollway Ludo
        </h1>
        {screen === "playing" && active && <Match key={gameNo} start={active} onQuit={quit} />}
        {screen === "lobby" && (
          <Lobby
            opts={opts}
            onChange={setOpts}
            onStart={startNew}
            onContinue={saved ? resume : null}
            onLeaderboard={() => setScreen("leaderboard")}
          />
        )}
        {screen === "leaderboard" && <LeaderboardView onBack={() => setScreen("lobby")} />}
        <ParticleLayer />
      </div>
    </PlatformShell>
  );
}
