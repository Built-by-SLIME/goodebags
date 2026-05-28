/* ═══════════════════════════════════════════
   APE-MOD-X  —  Game Engine
   Rules: 150 cards (Couture/Mutants/Mecha mixed)
   10 cards each, 5 traits + XTRA (defence bonus)
   Highest score wins round; ties = freeze & replay
═══════════════════════════════════════════ */

'use strict';

// ── R2 Asset Base (set from /api/config on load) ───
let R2 = '';

function r2url(path) {
  // path is like "assets/cards/AM#1.png" — encode # so browsers don't treat it as fragment
  return R2 + '/' + path.replace(/#/g, '%23');
}

// ── State ──────────────────────────────────
const S = {
  allCards: [],
  numOpponents: 1,
  playerHand: [],
  oppHands: [],       // array of arrays
  frozenPile: [],
  callerIndex: -1,    // 0 = human, 1-4 = computer
  calledTraitIdx: -1,
  sessionScore: 0,
  roundNum: 0,
  phase: 'lobby',     // lobby | deal | human-pick | resolve | next-round | result
};

// ── DOM refs ───────────────────────────────
const screens = {
  lobby:  document.getElementById('screen-lobby'),
  game:   document.getElementById('screen-game'),
  result: document.getElementById('screen-result'),
};
const oppZone       = document.getElementById('opponents-zone');
const playArea      = document.getElementById('cards-in-play');
const msgBox        = document.getElementById('message-box');
const playerCardArea = document.getElementById('player-card-area');
const playerBack    = document.getElementById('player-back');
const playerCountEl = document.getElementById('player-count');
const btnContinue   = document.getElementById('btn-continue');
const sessionScoreEl = document.getElementById('session-score');
const roundInfoEl    = document.getElementById('round-info');

// ── Helpers ────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickAnim(card) {
  const anims = card.animations;
  return anims[Math.floor(Math.random() * anims.length)];
}

function backFor(card) {
  if (!card) return R2 + '/assets/backs/couture-back.png';
  const d = card.deck;
  if (d === 'Mutants') return R2 + '/assets/backs/mutants-back.png';
  if (d === 'Mecha')   return R2 + '/assets/backs/mecha-back.png';
  return R2 + '/assets/backs/couture-back.png';
}

function msg(text) { msgBox.textContent = text; }
function updateScoreBar() {
  sessionScoreEl.textContent = `Score: ${S.sessionScore.toLocaleString()}`;
  roundInfoEl.textContent    = `Round ${S.roundNum}`;
}

// ── Init ────────────────────────────────────
document.querySelectorAll('.opp-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.opp-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    S.numOpponents = parseInt(btn.dataset.opp);
  });
});

document.getElementById('btn-start').addEventListener('click', async () => {
  const [cfgRes, cardsRes] = await Promise.all([
    fetch('/api/config'),
    fetch('data/cards.json')
  ]);
  const cfg = await cfgRes.json();
  R2 = (cfg.r2BaseUrl || '').replace(/\/$/, '') + '/apemodx';

  S.allCards = await cardsRes.json();
  // Rewrite all asset paths to full R2 URLs
  S.allCards.forEach(c => {
    c.image      = r2url(c.image);
    c.animations = c.animations.map(r2url);
  });
  startGame();
});

// ── Start / Deal ────────────────────────────
function startGame() {
  S.frozenPile = [];
  S.roundNum = 0;

  // Deal 10 random cards each
  const deck = shuffle([...S.allCards]);
  const total = S.numOpponents + 1;
  S.playerHand = deck.splice(0, 10);
  S.oppHands = [];
  for (let i = 0; i < S.numOpponents; i++) {
    S.oppHands.push(deck.splice(0, 10));
  }

  // Random first caller
  S.callerIndex = Math.floor(Math.random() * total);

  showScreen('game');
  buildTableUI();
  startRound();
}

// ── Build static table UI ───────────────────
function buildTableUI() {
  oppZone.innerHTML = '';
  for (let i = 0; i < S.numOpponents; i++) {
    const slot = document.createElement('div');
    slot.className = 'opponent-slot';
    slot.id = `opp-slot-${i}`;
    slot.innerHTML = `
      <div class="opp-stack">
        <img class="card-back-img opp-back" id="opp-back-${i}" src="${backFor(S.oppHands[i][0])}" alt="Opp deck" />
        <span class="card-count" id="opp-count-${i}">${S.oppHands[i].length}</span>
      </div>
      <div id="opp-active-${i}"></div>
      <span class="opp-label">Player ${i + 2}</span>`;
    oppZone.appendChild(slot);
  }
  updatePlayerBack();
}

function updatePlayerBack() {
  const top = S.playerHand[0];
  playerBack.src = top ? backFor(top) : R2 + '/assets/backs/couture-back.png';
  playerCountEl.textContent = S.playerHand.length;
}

// ── Round start ─────────────────────────────
function startRound() {
  S.roundNum++;
  updateScoreBar();
  playArea.innerHTML = '';
  playerCardArea.innerHTML = '';

  // Check for eliminations (0 active cards)
  checkEliminations();

  const activePlayers = getActivePlayers();
  if (activePlayers.length === 1) { endGame(); return; }

  // Ensure caller still has cards; if not, pick next
  while (!playerHasCards(S.callerIndex)) {
    S.callerIndex = (S.callerIndex + 1) % (S.numOpponents + 1);
  }

  if (S.callerIndex === 0) {
    humanCallPhase();
  } else {
    computerCallPhase();
  }
}

function playerHasCards(idx) {
  return idx === 0 ? S.playerHand.length > 0 : S.oppHands[idx - 1].length > 0;
}

function getActivePlayers() {
  const active = [];
  if (S.playerHand.length > 0) active.push(0);
  S.oppHands.forEach((h, i) => { if (h.length > 0) active.push(i + 1); });
  return active;
}

function checkEliminations() {
  // Nothing to do visually here — zero-card players are just skipped
}

// ── Human calls ─────────────────────────────
function humanCallPhase() {
  const card = S.playerHand[0];
  msg(`Your turn to call! Pick the trait you want to play. (You are the caller — no XTRA bonus for you this round)`);
  playerCardArea.innerHTML = '';

  const cardEl = document.createElement('div');
  cardEl.className = 'player-card';
  cardEl.innerHTML = `<img src="${card.image}" alt="${card.id}" onerror="this.style.background='#222'" />
    <div class="trait-list">
      ${card.traits.map((t, i) => `
        <button class="trait-btn" data-idx="${i}">
          <span class="t-name">${t.name}</span>
          <span class="t-val">${t.value}</span>
        </button>`).join('')}
      <div class="trait-btn xtra-row" style="pointer-events:none">
        <span class="t-name">XTRA: ${card.xtra.name}</span>
        <span class="t-val">${card.xtra.value}</span>
      </div>
    </div>`;

  cardEl.querySelectorAll('.trait-btn[data-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      S.calledTraitIdx = parseInt(btn.dataset.idx);
      resolveRound();
    });
  });

  playerCardArea.appendChild(cardEl);
  btnContinue.style.display = 'none';
  S.phase = 'human-pick';
}

// ── Computer calls ───────────────────────────
function computerCallPhase() {
  const oppIdx = S.callerIndex - 1;
  const card = S.oppHands[oppIdx][0];

  // Computer picks highest base trait
  let best = 0;
  card.traits.forEach((t, i) => { if (t.value > card.traits[best].value) best = i; });
  S.calledTraitIdx = best;

  const traitName = card.traits[best].name;
  const traitVal  = card.traits[best].value;

  msg(`Player ${S.callerIndex + 1} calls: "${traitName}" — ${traitVal}. Revealing all cards...`);
  showOppCallerCard(oppIdx, card);

  // Show player's card face up
  showPlayerFaceUp(false); // not caller, so XTRA applies

  // Show other opps face up
  for (let i = 0; i < S.numOpponents; i++) {
    if (i !== oppIdx && S.oppHands[i].length > 0) {
      showOppFaceUp(i, false);
    }
  }

  btnContinue.style.display = 'block';
  btnContinue.onclick = () => resolveRound();
}

function showOppCallerCard(oppIdx, card) {
  const el = document.getElementById(`opp-active-${oppIdx}`);
  if (!el) return;
  el.innerHTML = `<img class="opp-active-card" src="${card.image}" alt="${card.id}" onerror="this.style.background='#333'" />`;
}

function showPlayerFaceUp(isCaller) {
  if (S.playerHand.length === 0) return;
  const card = S.playerHand[0];
  const cardEl = document.createElement('div');
  cardEl.className = 'player-card';
  cardEl.innerHTML = `<img src="${card.image}" alt="${card.id}" onerror="this.style.background='#222'" />
    <div class="trait-list">
      ${card.traits.map((t, i) => `
        <div class="trait-btn ${i === S.calledTraitIdx ? 'selected' : ''}" style="pointer-events:none">
          <span class="t-name">${t.name}</span>
          <span class="t-val">${t.value}</span>
        </div>`).join('')}
      ${!isCaller && card.xtra.value > 0 ? `
        <div class="trait-btn xtra-row" style="pointer-events:none">
          <span class="t-name">+XTRA: ${card.xtra.name}</span>
          <span class="t-val">+${card.xtra.value}</span>
        </div>` : ''}
    </div>`;
  playerCardArea.appendChild(cardEl);
}

function showOppFaceUp(oppIdx, isCaller) {
  if (S.oppHands[oppIdx].length === 0) return;
  const card = S.oppHands[oppIdx][0];
  const el = document.getElementById(`opp-active-${oppIdx}`);
  if (!el) return;
  el.innerHTML = `<img class="opp-active-card" src="${card.image}" alt="${card.id}" onerror="this.style.background='#333'" />`;
}

// ── Resolve round ────────────────────────────
function resolveRound() {
  btnContinue.style.display = 'none';
  const traitIdx = S.calledTraitIdx;

  // Calculate scores for each active player
  // Caller gets base trait value only; others add XTRA
  const scores = [];

  // Player (index 0)
  if (S.playerHand.length > 0) {
    const card = S.playerHand[0];
    const base = card.traits[traitIdx].value;
    const xtra = (S.callerIndex !== 0) ? card.xtra.value : 0;
    scores.push({ playerIdx: 0, card, score: base + xtra, base, xtra });
  }

  // Opponents
  for (let i = 0; i < S.numOpponents; i++) {
    if (S.oppHands[i].length === 0) continue;
    const card = S.oppHands[i][0];
    const base = card.traits[traitIdx].value;
    const xtra = (S.callerIndex !== i + 1) ? card.xtra.value : 0;
    scores.push({ playerIdx: i + 1, card, score: base + xtra, base, xtra });
  }

  // Find max score
  const maxScore = Math.max(...scores.map(s => s.score));
  const winners  = scores.filter(s => s.score === maxScore);
  const losers   = scores.filter(s => s.score < maxScore);
  const isTie    = winners.length > 1;

  // All played cards (one per active player)
  const roundCards = scores.map(s => s.card);

  if (isTie) {
    // Freeze all round cards + existing frozen pile
    S.frozenPile.push(...roundCards);

    // Remove top card from each active player (they go to frozen)
    if (S.playerHand.length > 0) S.playerHand.shift();
    for (let i = 0; i < S.numOpponents; i++) {
      if (S.oppHands[i].length > 0) S.oppHands[i].shift();
    }

    // Check if any tying player now has 0 cards → eliminated
    const stillAlive = winners.filter(w => playerHasCards(w.playerIdx));
    if (stillAlive.length === 1) {
      // Only one tying player left — they win the frozen pile
      giveCardsToWinner(stillAlive[0].playerIdx, S.frozenPile);
      S.frozenPile = [];
    }

    const tieNames = winners.map(w => w.playerIdx === 0 ? 'You' : `Player ${w.playerIdx + 1}`).join(' & ');
    msg(`Tie between ${tieNames}! Cards frozen. ${S.frozenPile.length} cards on the table. Same caller goes again...`);
    updateAllCounts();
    btnContinue.style.display = 'block';
    btnContinue.onclick = () => startRound();
  } else {
    const winnerData = winners[0];
    const winnerIdx  = winnerData.playerIdx;
    const winnerName = winnerIdx === 0 ? 'You' : `Player ${winnerIdx + 1}`;

    // Remove top card from each active player, put all in won pile + frozen
    const won = [...roundCards, ...S.frozenPile];
    S.frozenPile = [];

    if (S.playerHand.length > 0) S.playerHand.shift();
    for (let i = 0; i < S.numOpponents; i++) {
      if (S.oppHands[i].length > 0) S.oppHands[i].shift();
    }

    giveCardsToWinner(winnerIdx, won);
    S.callerIndex = winnerIdx; // winner calls next

    const traitName = scores[0].card.traits[traitIdx].name;
    msg(`${winnerName} wins the round! (${traitName}: ${maxScore}) — ${won.length} card(s) won.`);
    updateAllCounts();

    // Play winning card animation
    playWinAnimation(winnerData.card, () => {
      const activePlayers = getActivePlayers();
      if (activePlayers.length === 1) { endGame(); return; }
      btnContinue.style.display = 'block';
      btnContinue.onclick = () => startRound();
    });
  }
}

function giveCardsToWinner(winnerIdx, cards) {
  if (winnerIdx === 0) {
    S.playerHand.push(...cards);
    updatePlayerBack();
  } else {
    S.oppHands[winnerIdx - 1].push(...cards);
    updateOppBack(winnerIdx - 1);
  }
}

function updateAllCounts() {
  updatePlayerBack();
  for (let i = 0; i < S.numOpponents; i++) updateOppBack(i);
  updateScoreBar();
}

// ── Win animation ─────────────────────────────
function playWinAnimation(card, callback) {
  const overlay = document.getElementById('win-animation-overlay');
  const video   = document.getElementById('win-video');
  const src     = pickAnim(card);

  video.src = src;
  video.muted = false; // enable sound
  overlay.style.display = 'flex';

  video.play().catch(() => { video.muted = true; video.play(); });

  const close = () => {
    overlay.style.display = 'none';
    video.src = '';
    overlay.removeEventListener('click', close);
    video.removeEventListener('ended', close);
    callback();
  };
  video.addEventListener('ended', close);
  overlay.addEventListener('click', close);
}

// ── End game ──────────────────────────────────
function endGame() {
  const humanWon = S.playerHand.length > 0;
  const points   = humanWon ? 1000 * S.numOpponents : 0;
  S.sessionScore += points;

  document.getElementById('result-icon').textContent  = humanWon ? '🏆' : '💀';
  document.getElementById('result-title').textContent = humanWon ? 'You Win!' : 'You Lost!';
  document.getElementById('result-msg').textContent   = humanWon
    ? `You collected all the cards and beat ${S.numOpponents} opponent(s)!`
    : 'Better luck next time — the computer took all the cards.';
  document.getElementById('result-points').textContent = `+${points.toLocaleString()}`;
  document.getElementById('result-total').textContent  = S.sessionScore.toLocaleString();

  showScreen('result');

  // Play again countdown (60s)
  if (humanWon) {
    let t = 60;
    const timerEl = document.getElementById('play-again-timer');
    timerEl.textContent = `Auto-play again in ${t}s...`;
    const iv = setInterval(() => {
      t--;
      timerEl.textContent = `Auto-play again in ${t}s...`;
      if (t <= 0) { clearInterval(iv); playAgain(); }
    }, 1000);
    document.getElementById('btn-play-again').onclick = () => { clearInterval(iv); playAgain(); };
    document.getElementById('btn-quit').onclick = () => { clearInterval(iv); goToMenu(); };
  } else {
    document.getElementById('btn-play-again').onclick = playAgain;
    document.getElementById('btn-quit').onclick = goToMenu;
    document.getElementById('play-again-timer').textContent = '';
  }
}

function playAgain() {
  S.callerIndex = 0; // winner (human) starts next game
  startGame();
}

function goToMenu() { window.location.href = '/games/'; }


function updateOppBack(i) {
  const back = document.getElementById(`opp-back-${i}`);
  const count = document.getElementById(`opp-count-${i}`);
  if (back) back.src = S.oppHands[i].length ? backFor(S.oppHands[i][0]) : R2 + '/assets/backs/couture-back.png';
  if (count) count.textContent = S.oppHands[i].length;
}
