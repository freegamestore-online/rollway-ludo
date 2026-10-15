import { GameShell as PlatformShell, GameTopbar, GameAuth } from "@freegamestore/games";
import { ParticleLayer } from "./feel";

/**
 * The game's frame: the platform shell, the title, and a canvas that the board
 * will draw into. The canvas is the feel layer, which draws particle bursts, so
 * captures and finishes can use it later without changing this file.
 */
export default function GameShell() {
  return (
    <PlatformShell topbar={<GameTopbar title="Rollway Ludo" score={0} />}>
      <GameAuth />
      <div className="relative flex flex-col items-center justify-center h-full gap-4">
        <h1
          className="text-3xl font-bold"
          style={{ fontFamily: "Fraunces, serif" }}
        >
          Rollway Ludo
        </h1>
        <p style={{ color: "var(--muted)" }}>
          Your game will appear here once it&rsquo;s built.
        </p>
        <ParticleLayer />
      </div>
    </PlatformShell>
  );
}
