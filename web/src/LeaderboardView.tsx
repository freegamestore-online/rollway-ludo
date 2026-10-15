import { GameButton, Leaderboard, useLeaderboard } from "@freegamestore/games";
import { GAME_ID } from "./game/leaderboard";

interface LeaderboardViewProps {
  onBack: () => void;
}

/** The platform leaderboard for this game, with a way back to the menu. */
export default function LeaderboardView({ onBack }: LeaderboardViewProps) {
  const { topScores, recentScores, loading } = useLeaderboard(GAME_ID);
  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-md min-h-0">
      <Leaderboard topScores={topScores} recentScores={recentScores} loading={loading} />
      <GameButton variant="secondary" block onClick={onBack}>
        Back
      </GameButton>
    </div>
  );
}
