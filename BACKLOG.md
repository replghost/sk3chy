# sk3chy Game Backlog

## Tier 1 — Core Gameplay
- [ ] Speed bonus scoring: `points = base * (timeRemaining / totalTime)`
- [ ] Word categories: replace BIP-39 with themed sets (animals, food, movies, etc.)
- [ ] Close guess feedback: fuzzy matching, show "almost!" on near-misses
- [ ] Guess rate limiting: max 1 guess/sec per player to prevent spam
- [ ] Show draw order in lobby: "You draw in round 3"
- [ ] Pause/resume: host-only button to freeze timer mid-game

## Tier 2 — Drawing Tools
- [ ] Brush smoothing: Catmull-Rom or Bezier interpolation on strokes
- [ ] Proper eraser: use `globalCompositeOperation = 'destination-out'`
- [ ] Fill bucket tool
- [ ] Shape tools: lines, circles, rectangles (hold Shift)
- [ ] Redo support (currently only undo)
- [ ] Undo/redo limit: cap at ~30 strokes to bound memory

## Tier 3 — UX & Feedback
- [ ] Sound effects: correct guess, timer warning, round end, game start
- [ ] Chat channel separate from guesses
- [ ] AFK detection: auto-spectate after 60s idle
- [ ] Player kick (host-only)
- [ ] Ready-up system before game start
- [ ] Mobile fullscreen drawing mode
- [ ] Colorblind palette option

## Tier 4 — Scoring & Balance
- [ ] Scale drawer bonus by % of correct guessers
- [ ] Adjust scoring by number of active guessers per round
- [ ] Scale hint timing by word length (short words = fewer hints)
- [ ] Difficulty suggestions based on player count

## Tier 5 — Polish & Social
- [ ] Share results to social media
- [ ] Drawing replay / playback
- [ ] Per-round stats: guesses made, accuracy, time-to-guess
- [ ] Spectator count in UI
- [ ] Word selection timer (prevent stalling)

## Tier 6 — Advanced / Future
- [ ] Voice chat
- [ ] Custom word packs (user-provided)
- [ ] Ranked ladder (needs persistent backend)
- [ ] Drawing AI feedback
