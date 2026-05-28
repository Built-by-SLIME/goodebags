/**
 * device-guard.js
 * Blocks mobile screens and prompts tablet users to rotate to landscape.
 * Injected into both game pages (AMX + TBK) before any game script runs.
 */
(function () {
  'use strict';

  /* ── Thresholds ────────────────────────────────────────────────────────── */
  const MOBILE_MAX_PX  = 767;   // hard block below this width
  const TABLET_MAX_PX  = 1199;  // rotate-prompt up to this width (portrait only)

  /* ── Inject overlay HTML once ──────────────────────────────────────────── */
  function injectOverlays() {
    const style = document.createElement('style');
    style.textContent = `
      #gbg-device-overlay {
        display: none;
        position: fixed;
        inset: 0;
        z-index: 99999;
        background: #080808;
        color: #fff;
        font-family: Inter, sans-serif;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 32px;
        gap: 20px;
      }
      #gbg-device-overlay.visible { display: flex; }
      #gbg-device-overlay .gbg-overlay-icon { font-size: 3rem; }
      #gbg-device-overlay h2 {
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0;
        color: #FFD700;
      }
      #gbg-device-overlay p {
        font-size: 1rem;
        line-height: 1.6;
        color: #ccc;
        margin: 0;
        max-width: 420px;
      }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'gbg-device-overlay';
    overlay.innerHTML = `
      <div class="gbg-overlay-icon" id="gbg-overlay-icon">📵</div>
      <h2 id="gbg-overlay-title">Desktop or Tablet Required</h2>
      <p id="gbg-overlay-msg">
        This game is designed for PC and tablets.
        Please switch to a larger screen to play.
      </p>
    `;
    document.body.appendChild(overlay);
  }

  /* ── Evaluate current screen state ────────────────────────────────────── */
  function evaluate() {
    const overlay = document.getElementById('gbg-device-overlay');
    if (!overlay) return;

    const icon  = document.getElementById('gbg-overlay-icon');
    const title = document.getElementById('gbg-overlay-title');
    const msg   = document.getElementById('gbg-overlay-msg');

    const w = window.innerWidth;
    const h = window.innerHeight;
    const isPortrait = h > w;

    if (w <= MOBILE_MAX_PX) {
      // Hard block — phone-sized screen
      icon.textContent  = '📵';
      title.textContent = 'Desktop or Tablet Required';
      msg.textContent   = 'This game is designed for PC and tablets only. Please switch to a larger screen to play.';
      overlay.classList.add('visible');

    } else if (w <= TABLET_MAX_PX && isPortrait) {
      // Soft prompt — tablet held in portrait
      icon.textContent  = '🔄';
      title.textContent = 'Rotate Your Device';
      msg.textContent   = 'Please rotate your tablet to landscape mode for the best experience.';
      overlay.classList.add('visible');

    } else {
      // All good — PC or landscape tablet
      overlay.classList.remove('visible');
    }
  }

  /* ── Boot ──────────────────────────────────────────────────────────────── */
  function init() {
    injectOverlays();
    evaluate();
    window.addEventListener('resize', evaluate);
    window.addEventListener('orientationchange', function () {
      // Small delay — orientationchange fires before innerWidth updates
      setTimeout(evaluate, 100);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
