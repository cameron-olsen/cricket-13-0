# 13-0 — Build the Unbeaten XI

A cricket take on the 82-0 / DynastyDraft genre. A slot machine spins a **nation × decade**;
from every player that country fielded that decade you pick one and slot them into your XI.
Eleven spins, eleven players, one full side — then play a year of Tests and chase the
impossible **13-0**.

Play: open `index.html` in any browser (it's a single self-contained file — no build step).

## Status
- Game is fully playable (desktop + mobile).
- Player **ratings** are era-adjusted under the hood (difficulty, not nostalgia); they are
  hidden in the draft.
- Player **stats** are currently a curated set; the real per-decade ESPNcricinfo data is
  being ingested via the pipeline in `/data` (1940s batting loaded as the first worked example).

## Repo layout
- `index.html` — the game (also kept as `13-0.html`).
- `data/parse-espn.js` — converts a Statsguru paste into clean, Ave-validated rows (Markdown + JSON).
- `data/raw/` — raw stat captures, one file per decade.
- `data/<decade>-batting.md` / `.json` — parsed, validated output.

## Roadmap
- Load real per-decade batting + **bowling** + **fielding/dismissals** for all decades
  (see `data/parse-espn.js`; bowling/fielding tables still needed).
- Move to Vercel for hosting and Supabase for the stats data layer.
