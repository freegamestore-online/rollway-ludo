import { Leaderboard, useLeaderboard } from "@freegamestore/games";
import { GAME_ID } from "./game/leaderboard";

interface LeaderboardViewProps {
  onBack: () => void;
}

/** The platform leaderboard for this game, with a way back to the options. */
export default function LeaderboardView({ onBack }: LeaderboardViewProps) {
  const { topScores, recentScores, loading } = useLeaderboard(GAME_ID);
  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-md">
      <Leaderboard topScores={topScores} recentScores={recentScores} loading={loading} />
      <button type="button" className="rounded-full px-4 py-2 text-sm" style={{ border: "1px solid var(--line-strong)" }} onClick={onBack}>
        Back
      </button>
    </div>
  );
}
