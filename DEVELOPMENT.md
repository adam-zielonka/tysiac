# Development

Use Node.js 24.22+ (24–26) and pnpm 12. The repository pins the verified package manager and runtime.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm build
pnpm audit --audit-level=high
pnpm test
pnpm check
```

Pull requests run validation without deploying. Pages deployment is restricted to
the default branch (`main`). Dependabot checks compatible updates weekly; major
updates are reviewed separately.

Components use Svelte 5 in legacy syntax mode, with the `mount` API at startup.

## Structure

- `src/engine/rules.ts`, `Card.ts`, `Deal.ts` — the rules and a pure deal state
  machine (auction, musik, gifts, contract, tricks, scoring) without timers.
  `Deal.viewFor(seat)` hides what that seat may not know.
- `src/engine/sampling.ts` — deals hidden cards consistently with a view
  (played cards, voids and excluded cards, marriage partners, gifts, musik,
  and the marriages proven by bids or contracts above 120).
- `src/engine/Game.ts` — the match to 1000: seats, scores, the 800 lock, bot
  timers and history. It is a Svelte store (`$game`).
- `src/engine/players/` — the bots, a bitmask play model shared by the
  searches, Monte Carlo helpers and alpha-beta.
- `src/elements/` — the interface; `src/i18n.ts` — Polish source texts with
  English translations.

Fair bots receive only `deal.viewFor(seat)`; only Ada is marked `omniscient`
and receives the full deal. Tests in `src/__tests__/` cover the rules,
sampling against a brute-force posterior and a replay of the public history,
an independent referee over random deals, the match flow with fake timers and every bot in every phase. Bot
timing tests measure CPU time, so they stay meaningful on a busy machine.
