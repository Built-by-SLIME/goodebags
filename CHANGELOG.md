# Goodebags Games — Changelog

All notable changes to this project are documented here.
Format: `[Date] — Description`

---

## [2026-05-28] — Chunk 1: Codebase Cleanup

### Removed
- `public/newtasks.md` — internal dev notes were publicly web-accessible; removed from `public/`
- `games/` directory (root level) — dead Hearthstone-style prototype that was never served and contradicted the live game rules; removed to eliminate confusion
- npm packages `@reown/appkit`, `@reown/appkit-adapter-ethers`, `ethers` — Ethereum ecosystem libraries unused in this Hedera/XRPL project; 210 packages removed from `node_modules`

### Added
- `package.json` → `build:wallet` script: `esbuild wallet-src/wallet.js --bundle --format=iife --global-name=WalletModule --outfile=public/js/wallet.bundle.js` — provides a documented, reproducible way to rebuild the WalletConnect browser bundle

---

## [2026-05-28] — Chunk 2: New Board Assets

### Added
- `public/games/apemodx/assets/boards/` — 13 poker table boards for AMX (ape-01 through ape-11 + universal-01, universal-02); all confirmed 1920×1080 (16:9)
- `public/games/tbk/assets/boards/` — 4 poker table boards for TBK (tbk-01, tbk-02 + universal-01, universal-02)
- `scripts/check_image_dims.py` — utility script to verify image dimensions

---

## [2026-05-28] — Chunk 3: Mobile & Tablet Device Guard

### Added
- `public/js/device-guard.js` — shared device detection overlay; hard-blocks phones (< 768px), prompts tablet users in portrait to rotate to landscape; PC/landscape tablet passes through
- Both game pages now include `device-guard.js` before `game.js` so the guard is ready on first paint

---

## [2026-05-28] — Chunk 4: Lobby — 4th Opponent + Board Selector

### Added
- 4th opponent button (4,000 pts) to both AMX and TBK lobby screens — supports up to 4 computer opponents as per PDF spec
- `#screen-board-select` screen in both game pages — players must choose a table before the game begins; board persists for the full session (no re-selection between rounds)
- Board selector CSS in both `style.css` files — responsive grid, 16:9 thumbnails, gold selection highlight
- AMX: 13 board options in the selector; TBK: 4 board options

### Changed
- TBK `#screen-game` background is now set dynamically by `buildTableUI()` from the board selected; removed hardcoded `url('assets/table.jpg')` from CSS
- AMX `buildTableUI()` applies the selected board image to `.table-felt` at game start

---

## [2024-02-24] — Initial Build

- Created Railway-ready project structure (`server.js`, `package.json`, `public/`, `games/`)
- Built full one-page website from client's original WordPress reference screenshot
- Sections: Navbar, Hero, AlphaGroup/About, Features/Strategy, Mints, FAQ, CTA Banner, Footer
- Dark theme (`#080808` background) with neon green accent, Inter font
- Responsive layout with mobile hamburger nav and FAQ accordion
- Game routes pre-wired: `/games/game1` and `/games/game2`
- Pushed to GitHub: `Built-by-SLIME/goodebags`

---

## [2024-02-24] — Mints Section Update

- Renamed "Play Our Games" section to "Our Mints"
- Cards 1 & 2: The Bee's Knees — real images (`tbk356.png`, `tbk386.png`), linked to SentX public mint
- Cards 3 & 4: Ape-Mod X — real images (`amm164.png`, `am78.png`), Coming Soon (no link/button)
- Removed colored placeholder backgrounds; added image hover zoom effect

---

## [2024-02-24] — Accent Color Rebrand (Green → Yellow)

- Swapped all accent colors from neon green (`#39FF14`) to golden yellow (`#FFD700`)
- Updated CSS variables, all rgba glow values, badges, borders, logo SVG, and SVG chart
- Renamed "Coming Soon" cards 3 & 4 to "Ape-Mod X"

---

## [2024-02-24] — Real Assets Swapped In

- Replaced placeholder SVG logo with `Goodebags Games Text logo HD.png` (navbar + footer)
- Added `New Base Ape (1).png` as hero section character image
- Added `Bees Knees Plain white layer (1).png` as About section character image
- Fixed SVG chart stroke color (was still hardcoded green, now yellow)

---

## [2024-02-24] — Fix Broken Images (URL-safe Filenames)

- Renamed assets with spaces/parentheses to kebab-case to fix browser URL resolution:
  - `Goodebags Games Text logo HD.png` → `goodebags-logo.png`
  - `New Base Ape (1).png` → `new-base-ape.png`
  - `Bees Knees Plain white layer (1).png` → `bees-knees-character.png`
- Updated all HTML `src` references accordingly

---

## [2024-02-24] — Navbar Restructure: Socials, Right-aligned Nav, Connect Wallet

- Moved all nav items (socials, links, button) into a right-aligned `.nav-right` group
- Added Discord, X, TikTok, Instagram icon links to navbar with a divider separator
- Changed "Get Started" button to "Connect Wallet" (placeholder for WalletConnect modal)
- Updated nav link label "Games" → "Mints" to match section rename
- Mobile: socials and divider hidden; hamburger menu unchanged

---

## [2024-02-24] — Logo Size + Navbar Thickness Adjustments

- Increased logo height from `40px` → `120px` per client request (attempt 1)
- Restored navbar padding + reduced logo height to keep navbar at original thickness
- Logo now `36px` height (visually sized to the actual text in the PNG — note: PNG may have built-in transparent padding; adjust `height` in `style.css` `.logo-img` if needed)
- Hero top padding restored to `160px`
