/* ═══════════════════════════════════════════
   THE BEE'S KNEES  —  Game Engine
   Rules: 50 cards, 8 traits, NO XTRA bonus
   10 cards each, highest trait score wins round
   Ties = freeze cards & replay with same caller
═══════════════════════════════════════════ */

'use strict';

// ── R2 Asset Base (set from /api/config on load) ───
let R2 = '';

function r2url(path) {
  return R2 + '/' + path.replace(/#/g, '%23');
}

const S = {
  allCards: [],
  numOpponents: 1,
  playerHand: [],
  oppHands: [],
  frozenPile: [],
  callerIndex: -1,
  calledTraitIdx: -1,
  sessionScore: 0,
  roundNum: 0,
};

const screens = {
  lobby:  document.getElementById('screen-lobby'),
  game:   document.getElementById('screen-game'),
  result: document.getElementById('screen-result'),
};
const oppZone        = document.getElementById('opponents-zone');
const msgBox         = document.getElementById('message-box');
const playerCardArea = document.getElementById('player-card-area');
const playerBack     = document.getElementById('player-back');
const playerCountEl  = document.getElementById('player-count');
const btnContinue    = document.getElementById('btn-continue');
const sessionScoreEl = document.getElementById('session-score');
const roundInfoEl    = document.getElementById('round-info');

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
  const a = card.animations;
  return a[Math.floor(Math.random() * a.length)];
}

function msg(t) { msgBox.textContent = t; }

function updateScoreBar() {
  sessionScoreEl.textContent = `Score: ${S.sessionScore.toLocaleString()}`;
  roundInfoEl.textContent    = `Round ${S.roundNum}`;
}

// ── Lobby ───────────────────────────────────
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
  R2 = (cfg.r2BaseUrl || '').replace(/\/$/, '') + '/tbk';

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
  const deck = shuffle([...S.allCards]);
  S.playerHand = deck.splice(0, 10);
  S.oppHands = [];
  for (let i = 0; i < S.numOpponents; i++) S.oppHands.push(deck.splice(0, 10));
  S.callerIndex = Math.floor(Math.random() * (S.numOpponents + 1));
  showScreen('game');
  buildTableUI();
  startRound();
}

// ── Table UI ────────────────────────────────
function buildTableUI() {
  oppZone.innerHTML = '';
  for (let i = 0; i < S.numOpponents; i++) {
    const slot = document.createElement('div');
    slot.className = 'opponent-slot';
    slot.id = `opp-slot-${i}`;
    slot.innerHTML = `
      <div class="opp-stack">
        <img class="card-back-img" id="opp-back-${i}" src="${R2}/assets/backs/tbk-back.png" alt="Opp deck" />
        <span class="card-count" id="opp-count-${i}">${S.oppHands[i].length}</span>
      </div>
      <div id="opp-active-${i}"></div>
      <span class="opp-label">Player ${i + 2}</span>`;
    oppZone.appendChild(slot);
  }
  updatePlayerBack();
}

function updatePlayerBack() {
  playerBack.src = R2 + '/assets/backs/tbk-back.png';
  playerCountEl.textContent = S.playerHand.length;
}

function updateOppBack(i) {
  const count = document.getElementById(`opp-count-${i}`);
  if (count) count.textContent = S.oppHands[i].length;
}

function updateAllCounts() {
  updatePlayerBack();
  for (let i = 0; i < S.numOpponents; i++) updateOppBack(i);
  updateScoreBar();
}

// ── Round ───────────────────────────────────
function startRound() {
  S.roundNum++;
  updateScoreBar();
  playerCardArea.innerHTML = '';
  document.getElementById('cards-in-play').innerHTML = '';

  const activePlayers = getActivePlayers();
  if (activePlayers.length === 1) { endGame(); return; }

  while (!playerHasCards(S.callerIndex)) {
    S.callerIndex = (S.callerIndex + 1) % (S.numOpponents + 1);
  }

  S.callerIndex === 0 ? humanCallPhase() : computerCallPhase();
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

// ── Human calls ─────────────────────────────
function humanCallPhase() {
  const card = S.playerHand[0];
  msg('Your turn! Pick the trait you want to play.');
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
    </div>`;

  cardEl.querySelectorAll('.trait-btn[data-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      S.calledTraitIdx = parseInt(btn.dataset.idx);
      resolveRound();
    });
  });

  playerCardArea.appendChild(cardEl);
  btnContinue.style.display = 'none';
}

// ── Computer calls ───────────────────────────
function computerCallPhase() {
  const oppIdx = S.callerIndex - 1;
  const card = S.oppHands[oppIdx][0];
  let best = 0;
  card.traits.forEach((t, i) => { if (t.value > card.traits[best].value) best = i; });
  S.calledTraitIdx = best;

  const traitName = card.traits[best].name;
  const traitVal  = card.traits[best].value;

  msg(`Player ${S.callerIndex + 1} calls: "${traitName}" — ${traitVal}`);

  const el = document.getElementById(`opp-active-${oppIdx}`);
  if (el) el.innerHTML = `<img class="opp-active-card" src="${card.image}" alt="${card.id}" onerror="this.style.background='#333'" />`;

  // Show player face up
  if (S.playerHand.length > 0) {
    const pc = S.playerHand[0];
    playerCardArea.innerHTML = '';
    const cardEl = document.createElement('div');
    cardEl.className = 'player-card';
    cardEl.innerHTML = `<img src="${pc.image}" alt="${pc.id}" onerror="this.style.background='#222'" />
      <div class="trait-list">
        ${pc.traits.map((t, i) => `
          <div class="trait-btn ${i === S.calledTraitIdx ? 'selected' : ''}" style="pointer-events:none">
            <span class="t-name">${t.name}</span>
            <span class="t-val">${t.value}</span>
          </div>`).join('')}
      </div>`;
    playerCardArea.appendChild(cardEl);
  }

  btnContinue.style.display = 'block';
  btnContinue.onclick = () => resolveRound();
}

// ── Resolve round ────────────────────────────
function resolveRound() {
  btnContinue.style.display = 'none';
  const traitIdx = S.calledTraitIdx;

  const scores = [];

  if (S.playerHand.length > 0) {
    const card = S.playerHand[0];
    scores.push({ playerIdx: 0, card, score: card.traits[traitIdx].value });
  }
  for (let i = 0; i < S.numOpponents; i++) {
    if (S.oppHands[i].length === 0) continue;
    const card = S.oppHands[i][0];
    scores.push({ playerIdx: i + 1, card, score: card.traits[traitIdx].value });
  }

  const maxScore = Math.max(...scores.map(s => s.score));
  const winners  = scores.filter(s => s.score === maxScore);
  const isTie    = winners.length > 1;
  const roundCards = scores.map(s => s.card);

  if (isTie) {
    S.frozenPile.push(...roundCards);
    if (S.playerHand.length > 0) S.playerHand.shift();
    for (let i = 0; i < S.numOpponents; i++) {
      if (S.oppHands[i].length > 0) S.oppHands[i].shift();
    }
    const stillAlive = winners.filter(w => playerHasCards(w.playerIdx));
    if (stillAlive.length === 1) {
      giveCardsToWinner(stillAlive[0].playerIdx, S.frozenPile);
      S.frozenPile = [];
    }
    const tieNames = winners.map(w => w.playerIdx === 0 ? 'You' : `Player ${w.playerIdx + 1}`).join(' & ');
    msg(`Tie between ${tieNames}! ${S.frozenPile.length} cards frozen on the table. Same caller goes again...`);
    updateAllCounts();
    btnContinue.style.display = 'block';
    btnContinue.onclick = () => startRound();
  } else {
    const winnerIdx  = winners[0].playerIdx;
    const winnerName = winnerIdx === 0 ? 'You' : `Player ${winnerIdx + 1}`;
    const won = [...roundCards, ...S.frozenPile];
    S.frozenPile = [];

    if (S.playerHand.length > 0) S.playerHand.shift();
    for (let i = 0; i < S.numOpponents; i++) {
      if (S.oppHands[i].length > 0) S.oppHands[i].shift();
    }

    giveCardsToWinner(winnerIdx, won);
    S.callerIndex = winnerIdx;

    const traitName = scores[0].card.traits[traitIdx].name;
    msg(`${winnerName} wins the round! (${traitName}: ${maxScore}) — ${won.length} card(s) won.`);
    updateAllCounts();

    playWinAnimation(winners[0].card, () => {
      if (getActivePlayers().length === 1) { endGame(); return; }
      btnContinue.style.display = 'block';
      btnContinue.onclick = () => startRound();
    });
  }
}

function giveCardsToWinner(winnerIdx, cards) {
  if (winnerIdx === 0) {
    S.playerHand.push(...cards);
  } else {
    S.oppHands[winnerIdx - 1].push(...cards);
  }
}

// ── Win animation ─────────────────────────────
function playWinAnimation(card, callback) {
  const overlay = document.getElementById('win-animation-overlay');
  const video   = document.getElementById('win-video');
  video.src = pickAnim(card);
  video.muted = false;
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

  document.getElementById('result-icon').textContent  = humanWon ? '🏆' : '🐝';
  document.getElementById('result-title').textContent = humanWon ? 'You Win!' : 'You Lost!';
  document.getElementById('result-msg').textContent   = humanWon
    ? `You collected all the cards and beat ${S.numOpponents} opponent(s)! Always bee cool 🐝`
    : 'The bees got you this time. Always bee kind. 🐝';
  document.getElementById('result-points').textContent = `+${points.toLocaleString()}`;
  document.getElementById('result-total').textContent  = S.sessionScore.toLocaleString();
  showScreen('result');

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
    document.getElementById('btn-quit').onclick = () => { clearInterval(iv); window.location.href = '/games/'; };
  } else {
    document.getElementById('btn-play-again').onclick = playAgain;
    document.getElementById('btn-quit').onclick = () => window.location.href = '/games/';
    document.getElementById('play-again-timer').textContent = '';
  }
}

function playAgain() { S.callerIndex = 0; startGame(); }
