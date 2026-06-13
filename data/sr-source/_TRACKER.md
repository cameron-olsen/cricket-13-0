# Strike-rate-enriched data — collection tracker

Each decade re-provided WITH strike-rate columns (batting SR + balls faced, bowling SR + economy),
which the original players.json lacked. Saved verbatim as `<decade>.txt` here. Once coverage is
complete, wire strike rate into batRating/bowlRating and the match-engine tempo/draw model.

## Received (all nations per decade)
- [x] 1930s  (1 missing vs game roster: KC James)
- [x] 1940s  (source paste truncated in the bowling tail — re-upload if needed)
- [x] 1950s  (source paste truncated in the bowling tail — re-upload if needed)
- [x] 1960s  (full coverage, 0 missing)
- [x] 1970s  (full coverage, 0 missing)
- [x] 1980s  (full coverage, 0 missing)
- [x] 1990s  (full coverage, 0 missing — batting from "1990s Batting.rtf", bowling from first 1990s.rtf)
- [x] 2000s  (full coverage, 0 missing — batting from first 1990s.rtf, bowling from "2000s bowling.rtf")
- [x] 2010s  (full coverage, 0 missing)
- [x] 2020s  (full coverage, 0 missing)

## ALL TEN DECADES COMPLETE — INTEGRATION PASS DONE (engine v4).
## Wired (2026-06-13): bowlSR -> bowlRating's 40% strike-rate term, era-adjusted via ERA_SR[dec][1]
##   with a spin/pace type tweak and a 0.768 balance calibration (activation is power-neutral vs v3:
##   mean rating change -0.08, it re-ranks bowlers by strike rate without inflating them). batSR
##   coverage gaps filled via the SRX2 overlay (data/srx2-overlay.json; 80 batSR + 42 bowlSR fills,
##   mostly 2000s-2020s players missing from SRX). Parser: data/build-srx2.js (reproduces the
##   existing SRX batSR exactly, 0 mismatches over 1597 lines). All v4 changes are gated behind
##   useRealSR; v1/v2/v3 + legacy "1|" replays are byte-identical (verified 300/300). New games emit
##   C4|/O5| share codes; old C/C2/C3/O..O4 codes still decode and verify against their frozen engine.
## NOTE: the milestone-rate fields (p100/p50/pduck/p5w in SRX) were NOT wired — the live scorecards
##   are now ball-by-ball (mInnings/mBall), so milestones emerge organically from ratings + batSR.
##   The only milestone-synthesizing path (genTourStats) now serves frozen legacy "1|" replays only.
## Only 1 roster player absent across the whole set: KC James (1930s NZ keeper).
## Note: 1940s/1950s bowling tails were truncated in the original paste, but every
##   game-roster player is present (truncation only hit non-roster low-wicket bowlers).

## Best workflow
Upload each decade as a file (.rtf/.txt) rather than pasting — it's filed byte-for-byte with no
transcription risk, and I run a coverage check against the game roster on each one.

## Parser notes — COLUMN SCHEMA CONFIRMED BY USER
- Markers: `+` incomplete ball count, `*` estimated, `-` n/a → strip +/*, treat - as null.
- Each player = "Name (TEAM)" line, then a tab-separated stats line beginning with Span (e.g. 1960-1968).
- BATTING (cols after the leading Span):
  Mat, Inns, NO, Runs, HS, Ave, BF, SR, 100, 30+, 50, 0, 4s, 6s
  -> 0-based stat index: BF = 6, batting SR = 7.  (No Ct/St here — keep fielding from players.json.)
- BOWLING (cols after the leading Span):
  Mat, Inns, Balls, Overs, BPO, Mdns, Runs, Wkts, BBI, BBM, Ave, Econ, SR, 3w, 4w, 5w, 10w
  -> 0-based stat index: Econ = 11, bowling SR = 12.
- KEY FIELDS TO EXTRACT per (player, decade): batting SR + BF (for confidence weighting); bowling SR + Econ.
  Bowling SR plugs straight into the dormant 40% strike-rate term already in bowlRating().
