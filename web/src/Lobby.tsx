import { effectiveTeamMode, type GameOptions, type SeatConfig } from "./game/options";

interface LobbyProps {
  opts: GameOptions;
  onChange: (opts: GameOptions) => void;
  onStart: () => void;
}

const SEAT_CHOICES: { value: string; label: string; seat: SeatConfig }[] = [
  { value: "human", label: "Human (pass and play)", seat: { type: "human" } },
  { value: "easy", label: "AI easy", seat: { type: "ai", difficulty: "easy" } },
  { value: "normal", label: "AI normal", seat: { type: "ai", difficulty: "normal" } },
  { value: "hard", label: "AI hard", seat: { type: "ai", difficulty: "hard" } },
];

const COLOUR_NAMES = ["Red", "Green", "Yellow", "Blue"];

/** Game options before the game starts: seats, team mode, and the rules toggles. */
export default function Lobby({ opts, onChange, onStart }: LobbyProps) {
  const teamAvailable = opts.numSeats === 4;

  const setSeat = (i: number, value: string) => {
    const choice = SEAT_CHOICES.find((c) => c.value === value) ?? SEAT_CHOICES[0]!;
    const seats = [...opts.seats] as GameOptions["seats"];
    seats[i] = choice.seat;
    onChange({ ...opts, seats });
  };

  return (
    <form
      className="flex flex-col gap-4 w-full max-w-sm"
      onSubmit={(e) => {
        e.preventDefault();
        onStart();
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="font-semibold">Players</span>
        <select
          className="border rounded p-2"
          style={{ borderColor: "var(--line-strong)", background: "var(--panel)", color: "var(--ink)" }}
          value={opts.numSeats}
          onChange={(e) => onChange({ ...opts, numSeats: Number(e.target.value) as 2 | 3 | 4 })}
        >
          <option value={2}>2 players</option>
          <option value={3}>3 players</option>
          <option value={4}>4 players</option>
        </select>
      </label>

      {Array.from({ length: opts.numSeats }, (_, i) => {
        const seat = opts.seats[i]!;
        const value = seat.type === "human" ? "human" : seat.difficulty;
        return (
          <label key={i} className="flex flex-col gap-1">
            <span className="font-semibold">
              Seat {i + 1} ({COLOUR_NAMES[i]})
            </span>
            <select
              className="border rounded p-2"
              style={{ borderColor: "var(--line-strong)", background: "var(--panel)", color: "var(--ink)" }}
              value={value}
              onChange={(e) => setSeat(i, e.target.value)}
            >
              {SEAT_CHOICES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        );
      })}

      <label className="flex items-center gap-2" style={{ opacity: teamAvailable ? 1 : 0.5 }}>
        <input
          type="checkbox"
          checked={effectiveTeamMode(opts)}
          disabled={!teamAvailable}
          onChange={(e) => onChange({ ...opts, teamMode: e.target.checked })}
        />
        <span>Team mode (2v2: seats 1 &amp; 3 vs seats 2 &amp; 4){teamAvailable ? "" : " — needs 4 players"}</span>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={opts.threeSixesForfeit}
          onChange={(e) => onChange({ ...opts, threeSixesForfeit: e.target.checked })}
        />
        <span>Three 6s in a row forfeit the turn</span>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={opts.autoMove}
          onChange={(e) => onChange({ ...opts, autoMove: e.target.checked })}
        />
        <span>Auto-move when there is only one legal move</span>
      </label>

      <button
        type="submit"
        className="rounded-full px-5 py-2 font-semibold"
        style={{ background: "var(--accent)", color: "#fff" }}
      >
        Start game
      </button>
    </form>
  );
}
