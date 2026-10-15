import { useState } from "react";
import { GameShell as PlatformShell, GameTopbar, GameAuth } from "@freegamestore/games";
import { ParticleLayer } from "./feel";
import Lobby from "./Lobby";
import Match from "./Match";
import { loadOptions, saveOptions, type GameOptions } from "./game/options";

/**
 * The game's frame: the platform shell, the title, and the particle layer. Shows
 * the options lobby, then a match. Options are restored from localStorage on load
 * and saved when a game starts.
 */
export default function GameShell() {
  const [opts, setOpts] = useState<GameOptions>(loadOptions);
  const [playing, setPlaying] = useState(false);
  // Bumped on each start, so every game gets a fresh Match.
  const [gameNo, setGameNo] = useState(0);

  const start = () => {
    saveOptions(opts);
    setGameNo((n) => n + 1);
    setPlaying(true);
  };

  return (
    <PlatformShell topbar={<GameTopbar title="Rollway Ludo" score={0} />}>
      <GameAuth />
      <div className="relative flex flex-col items-center justify-center h-full gap-4 p-4 overflow-y-auto">
        <h1 className="text-3xl font-bold" style={{ fontFamily: "Fraunces, serif" }}>
          Rollway Ludo
        </h1>
        {playing ? (
          <Match key={gameNo} opts={opts} onQuit={() => setPlaying(false)} />
        ) : (
          <Lobby opts={opts} onChange={setOpts} onStart={start} />
        )}
        <ParticleLayer />
      </div>
    </PlatformShell>
  );
}
