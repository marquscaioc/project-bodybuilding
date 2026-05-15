# Project: Bodybuilding — Scorecard

Live, math-locked digital scorecard for the **Project: Bodybuilding** YouTube show. Two hosts can score 1v1 bodybuilder comparisons in real time. No backend, no auth, fully client-side.

## The formula (locked)

Each row scores **margin × weight** to whichever athlete won the row.

| Axis        | Rows | Weight |
| ----------- | ---- | ------ |
| Poses       | 8    | x2     |
| Categories  | 4    | x1     |

Margin scale (1 to 4):

| Margin | Meaning                                       |
| ------ | --------------------------------------------- |
| 1      | Tight call, one detail tips it                |
| 2      | Clear edge, loser still in it                 |
| 3      | Decisive gap                                  |
| 4      | No contest, different tier                    |

Final display is on a 0–100 scale that always sums to 100:

```
differential = pointsA - pointsB
maxDifferential = 80   // (8 poses x 8 max) + (4 categories x 4 max)
displayA = 50 + (differential / 80) * 50
displayB = 100 - displayA
```

A perfect sweep = 100 to 0. A tie = 50 to 50 (shown as **DEAD HEAT**).

## Reference matchup (Kai vs Samson)

Used as the canonical fixture for unit tests:

- Kai points: 21
- Samson points: 24
- Final: **Kai 48.1 — Samson 51.9** (Samson wins by 3.8)

Run `npm test` to verify.

## Stack

- Next.js 14 (App Router) + TypeScript (strict)
- Tailwind CSS
- Zustand (client state)
- html-to-image (PNG export)
- Vitest (math unit tests)

## Scripts

```bash
npm run dev    # local dev
npm test       # run scoring tests
npm run build  # production build
npm start      # serve production build
```

## Deploy

Push to GitHub, import into Vercel. No env vars needed.
