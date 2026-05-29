# Goodebags Games — Agent Handover Doc

> **For the incoming agent.** Read this fully before touching any file.
> CSPO = Product Owner (the user). Your role = Developer.
> Build standard: production-grade. No shortcuts.

---

## 1. Project in one line
Two browser-based NFT top-trumps card games: **Ape-Mod-X** (XRPL) and **The Bee's Knees / TBK** (Hedera).
Deployed on Railway. Served by `server.js` (Express). All game code lives in `public/games/`.

---

## 2. What is already done (Chunks 1–6, committed to `main`)

| Chunk | What shipped |
|---|---|
| 1 | Dead prototype deleted, `newtasks.md` removed from public, Ethereum deps uninstalled, `build:wallet` script added |
| 2 | 17 new 1920×1080 boards copied into `public/` — 13 AMX boards + 4 TBK boards |
| 3 | `public/js/device-guard.js` — blocks < 768px, prompts tablet portrait to rotate |
| 4 | 4th opponent button (4 000 pts), board-selection screen (must pick table before game), board persists for full session |
| 5 | 16:9 aspect-ratio-locked board container; 6 absolute-positioned seat classes; `buildTableUI()` rewritten |
| 6 | Score submits on **loss or quit only** (not every win); 60s AFK countdown on result screen; winner goes first (`keepCaller`); TBK dealing count fixed (50 cards); `getWalletFromWC` extracted to `public/js/wallet-utils.js` |

---

## 3. What is still to build — CHUNK 7 (Visual Polish)

All four sub-tasks must be applied to **both** games (AMX + TBK) unless noted.

### 3a. Choosing-who-goes-first animation
- At the very start of `startGame()`, before the first `startRound()`, cycle a CSS highlight through every active seat (the `.opponent-slot` divs + `.seat-human`) in a short loop, then land on the actual caller.
- ~200ms per seat highlight; 2–3 full cycles then settle.
- Add a CSS class `.seat-active` (gold border / glow) and toggle it with a `setTimeout` chain.

### 3b. Card counts drop at round start
- In `startRound()`, immediately call `updateAllCounts()` **after** the cards are conceptually "in play" — i.e., decrement each active player's visible count by 1 the moment the round begins, before resolve.
- Currently counts only update after `resolveRound()`. Move the decrement to round start.

### 3c. XTRA row visually distinct
- In `humanCallPhase()` and `renderPlayerFaceUp()` / `renderOppFaceUp()` the XTRA row already has class `.xtra-row` / `.xtra` / `.xtra-add`.
- Add CSS to those classes: different background (e.g. subtle gold tint `rgba(255,215,0,0.12)`), italic label, small "BONUS" badge or left-border accent. Must look clearly different from standard trait rows.
- Must apply in both `style.css` files.

### 3d. Star ping shows winning score
- `highlightWinnerCard(wi)` in both `game.js` currently shows `#star-ping` (emoji only).
- Update so it shows the points value alongside the emoji: e.g. "⭐ +1,000".
- The value to show = `1000 * S.numOpponents` (same formula as `endGame()`).
- The ping element lives in the HTML as `#star-ping`; update its `textContent` before showing it.

---

## 4. Key architecture rules

### Seating layout
```
1 opp  →  seat-tc  (top-center)
2 opps →  seat-tl, seat-tr
3 opps →  seat-bl, seat-tl, seat-tr
4 opps →  seat-bl, seat-tl, seat-tr, seat-br
Human  →  seat-human (bottom-center, always)
```
Seats are absolutely positioned **as percentages** within `.table-felt` (the 16:9 board container).

### Score logic
- `S.sessionScore` accumulates in memory across multiple games in a session.
- `submitSessionScore()` is called **only** on: loss, manual quit, or 60s AFK timeout after a win.
- After a win: `startGame(true)` → `keepCaller=true` preserves `S.callerIndex` (the winner) as the first caller of the next game.
- After a loss: `goToLobby()` → resets `S.sessionScore = 0`, fresh session.

### File structure (relevant files only)
```
public/
  js/
    device-guard.js      ← shared, loaded first in both game HTMLs
    wallet-utils.js      ← shared getWalletFromWC(), loaded before game.js
  games/
    apemodx/
      index.html         ← includes device-guard, wallet-utils, game.js
      game.js            ← 424 lines — full game engine
      style.css          ← 263 lines — layout + seat classes
    tbk/
      index.html
      game.js            ← 433 lines — mirrors AMX, TBK theme
      style.css
scripts/
  verify_chunk6.py       ← quick sanity check script
CHANGELOG.md             ← update after Chunk 7 is done
```

### Board images
- AMX boards: `public/games/apemodx/assets/boards/ape-01.jpg` … `ape-11.jpg`, `universal-01.jpg`, `universal-02.jpg`
- TBK boards: `public/games/tbk/assets/boards/tbk-01.jpg`, `tbk-02.jpg`, `universal-01.jpg`, `universal-02.jpg`
- All are 1920×1080 (16:9). Set dynamically via `felt.style.backgroundImage`.

---

## 5. After Chunk 7 is done
1. Update `CHANGELOG.md` with a `## [date] — Chunk 7: Visual Polish` section.
2. Push to `main` with: `git add -A -- ':!New Poker Tables 1920/' && git commit -m "feat: Chunk 7 — visual polish"`
3. Do NOT commit the `New Poker Tables 1920/` folder — it is local source art only.

---

## 6. Task UUIDs (for task management tools)
- Root: `aycuPU1jTTG7KPbkQsFwa8`
- Chunk 7 parent: `cmEjgDuKNRqTBKaww5PQWR`
- Choosing-first animation: `vYLNh3XNgW6HpDTEhfR5yJ`
- Card count at round start: `vpiJ72BxMBufe2a2wPUkGc`
- XTRA distinct styling: `bs33UvdQgRZH9PDym7MaXv`
- Star ping with score: `kQ9CqATrsTTzjst1ByGh6V`
- CHANGELOG update: `rW7eyY7pdPPykEfLCxwhRP`
