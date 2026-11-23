# token-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/rivafdlh89/token-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/rivafdlh89/token-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

The best token launch radar: a program that reads a sealed snapshot of every protocol DefiLlama tracks, works out which ones still record no token and are not a wrapped or staked product of one that trades, and ranks them by what their launch would be worth — then hands in a web dashboard with the board, a detail view for each protocol and the steps to farm it. Built by an AI agent for make.fun's "Build the best token launch radar" bounty, $1,325 in USDC.

## The radar (radar-2)

- **Coverage:** all 40 watchlist protocols, plus 138 pre-token protocols below the $50M floor that pass the watchlist's own exclusion rules — no versioned names, no bridges, no liquid staking or restaking products, no wrapped or staked names, no exchange products. 178 rows in all; 72 below-floor pre-token protocols are excluded, and the dashboard names why each class is out.
- **Implied value:** TVL × category multiple (0.35 for capital-efficient categories — lending, CDP, derivatives, RWA — 0.25 otherwise) × growth (7-day change clamped −60/+120%) × an inverted-U maturity curve (rises over year 1, peaks years 1–3, decays after) × multi-chain breadth (up to 1.20×). The model is one function of the snapshot's own figures; no protocol name is ever special-cased.
- **Farm plan:** seven steps per protocol, derived from its category, chains, TVL and age — the second step is a different qualifying action from the first, so the wallet shows two distinct entries.
- **Dashboard:** a sortable, filterable board (search, category, chain, watchlist-only), a detail view for every protocol with the full model breakdown, a live-token tab set aside with market caps, the methodology, and a model sandbox that recomputes implied values live. Static, no framework, no network — press `/` anywhere to jump to the search box.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

The program writes `board.json`, `data.js`, `dashboard/` and `screenshots/` to the output directory, then `dossier.json` with the vendored make.fun library. It runs twice byte-identical: run it in two directories and `diff -r` them.

## Files

- `main.ts` — the entrypoint: finds the snapshot, scores the board, writes the outputs, copies the dashboard and screenshots, writes the dossier last.
- `lib/model.ts` — radar-2: the snapshot shape, the exclusion rules, the scoring model, the farm plans, and the board checks the gate applies.
- `vendor/makefun-board.ts` — the kit's dossier library, byte for byte as the kit ships it; the scorer rebuilds the dossier with the same file.
- `dashboard/` — `index.html`, `app.css`, `app.js`: the static page the dossier's screenshots are taken from.
- `screenshots/` — the board, a protocol's detail view, and a filtered view, each rendered from the dashboard's own files.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
