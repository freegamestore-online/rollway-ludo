# Compliance checklist

Rollway Ludo's checks against the FreeGameStore requirements, and how each one is met. The
automated ones run in CI (`compliance.yml`) and in `fgs check`.

## Copyright

- Licence: MIT, in `LICENSE`.
- Art is original. The board, tokens and die are drawn in code (SVG, from
  `web/src/Board.tsx` and `web/src/Die.tsx`). No images, fonts or sounds are copied
  from another game. The only images are the app icons in `web/public/`.
- Sounds are the platform's synthesised effects from `@freegamestore/games`. No audio files.
- The name "Rollway Ludo" is the game's own. The code and assets do not refer to any
  other game or brand.
- The new art and motion files (`board.ts`, `hop.ts`, `Board.tsx`, `Die.tsx`) carry a copyright header.

## Safe for work

- No text, images or sounds beyond the game's terms: the board, dice numbers, seat
  names and the menu.
- No user-generated content. Player names are the seat colours, and nothing typed by
  the player is shown to others.
- The leaderboard shows only a numeric score with the platform's own player name.

## Performance budget

- Largest JS asset: 78 KB gzipped, against a 300 KB limit (measured after `pnpm build`).
- The board is one SVG of roughly 110 elements, redrawn only when a token steps.
- Token hops are timed at 130 ms per square, and the animation stops as soon as the
  tokens match the game state.
- No external requests except Google Fonts and the leaderboard API.

## Accessibility

- Every token is a distinct shape (circle, triangle, square, diamond) with its number
  inside, so colour is never the only cue. Each token has a title such as
  "Red token 1, home" for screen readers.
- Tap targets are at least 44 px: the SDK's `GameButton` sizes, and inputs at
  `min-h-11`.
- Reduced motion: `prefers-reduced-motion` turns off the tumble, knock-back and
  celebration in CSS, and the hop jumps straight to the new square in code.
- Light and dark themes: the platform theme toggle sets `data-theme="dark"`; with no
  choice, the OS setting applies.
- The game fits the viewport with no scrolling (`overflow: hidden` on the shell).

## Splash screens and "coming soon"

- No splash screen and no "coming soon" text. The board appears on load, and a saved
  game resumes straight away.
