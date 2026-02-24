# Goodebag Games — Changelog

All notable changes to this project are documented here.
Format: `[Date] — Description`

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
