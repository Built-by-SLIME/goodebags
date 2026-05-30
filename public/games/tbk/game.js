/* ═══════════════════════════════════════════════════════════
   THE BEE'S KNEES  —  Game Engine  (per official rules)
   50 cards | 8 traits | NO XTRA bonus
   10 cards each | 1 human vs 1-4 computer opponents
   Highest trait wins the round; ties freeze cards
═══════════════════════════════════════════════════════════ */
'use strict';

// ── Config ───────────────────────────────────────────────
let R2 = '';
function r2url(p) { return R2 + '/' + p.replace(/#/g, '%23'); }

// ── State ────────────────────────────────────────────────
const S = {
  user: null, wallet: null, allCards: [],
  numOpponents: 1, playerHand: [], oppHands: [],
  frozenPile: [], callerIndex: -1, calledTraitIdx: -1,
  sessionScore: 0, roundNum: 0, roundsWon: 0,
  selectedBoard: null,
};

// ── DOM ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const screens = {
  auth:$('screen-auth'), register:$('screen-register'), lobby:$('screen-lobby'),
  'board-select':$('screen-board-select'), dealing:$('screen-dealing'),
  game:$('screen-game'), result:$('screen-result'), leaderboard:$('screen-leaderboard')
};

function show(name) {
  Object.values(screens).forEach(s => { s.style.display='none'; s.classList.remove('active'); });
  screens[name].style.display='flex'; screens[name].classList.add('active');
}

// ── Helpers ──────────────────────────────────────────────
function shuffle(arr) {
  const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a;
}
function pickAnim(c){const a=c.animations;return a[Math.floor(Math.random()*a.length)];}
function backFor(c){ return R2+(c?'/assets/backs/tbk-back.png':'/assets/backs/tbk-back.png'); }
function msg(t){$('message-box').textContent=t;}
function updateScoreBar(){$('round-info').textContent=`Round ${S.roundNum}`;$('session-score').textContent=`Score: ${S.sessionScore.toLocaleString()}`;}
function playerHasCards(idx){return idx===0?S.playerHand.length>0:S.oppHands[idx-1].length>0;}
function getActivePlayers(){const a=[];if(S.playerHand.length>0)a.push(0);S.oppHands.forEach((h,i)=>{if(h.length>0)a.push(i+1);});return a;}
function updatePlayerBack(){$('player-back').src=S.playerHand.length?backFor(S.playerHand[0]):R2+'/assets/backs/tbk-back.png';const pc=$('player-count');pc.textContent=S.playerHand.length;pc.title='Cards remaining in deck';const pl=$('player-name-label');if(pl)pl.textContent=(S.user?S.user.username:'You')+` (${S.playerHand.length} cards)`;}
function updateOppBack(i){const b=$(`opp-back-${i}`),c=$(`opp-count-${i}`),l=$(`opp-label-${i}`);if(b)b.src=backFor(S.oppHands[i][0]);if(c){c.textContent=S.oppHands[i].length;c.title='Cards remaining in deck';}if(l)l.textContent=`Bee ${i+2} (${S.oppHands[i].length} cards)`;}
function updateAllCounts(){updatePlayerBack();for(let i=0;i<S.numOpponents;i++)updateOppBack(i);updateScoreBar();}
function giveCardsToWinner(wi,cards){if(wi===0){S.playerHand.push(...cards);updatePlayerBack();}else{S.oppHands[wi-1].push(...cards);updateOppBack(wi-1);}}

// getWalletFromWC() is provided by /js/wallet-utils.js

// ── Auth ─────────────────────────────────────────────────
let _walletProjectId = '';

async function initAuth() {
  show('auth');
  $('auth-status').textContent = 'Checking wallet…';
  $('btn-connect-wallet').style.display = 'none';

  // Load R2 config + wallet project ID
  try {
    const cfg = await fetch('/api/config').then(r => r.json());
    R2 = (cfg.r2BaseUrl || '').replace(/\/$/, '') + '/tbk';
    _walletProjectId = cfg.walletConnectProjectId || '';
  } catch(e) {}

  // Read wallet address directly from WC's IndexedDB — instant, no network
  S.wallet = await getWalletFromWC();

  if (!S.wallet) {
    $('auth-status').textContent = 'Connect your wallet to play.';
    $('btn-connect-wallet').style.display = '';
    return;
  }

  // Look up or register user
  try {
    const res = await fetch(`/api/user/${S.wallet}`);
    if (res.ok) { S.user = await res.json(); goToLobby(); }
    else show('register');
  } catch(e) {
    S.user = { username: 'Guest', wallet_address: S.wallet };
    goToLobby();
  }
}

$('btn-connect-wallet').addEventListener('click', async () => {
  const btn = $('btn-connect-wallet');
  btn.disabled = true; btn.textContent = 'Connecting…';
  try {
    if (typeof WalletModule === 'undefined') throw new Error('Wallet module not loaded');
    await WalletModule.openConnect(_walletProjectId);
    await initAuth();
  } catch(e) {
    $('auth-status').textContent = 'Connection failed — please try again.';
    btn.disabled = false; btn.textContent = 'Connect Wallet';
  }
});

$('btn-register').addEventListener('click', async()=>{
  const username=$('username-input').value.trim();
  if(!username){$('register-error').textContent='Please enter a username.';return;}
  $('register-error').textContent=''; $('btn-register').disabled=true;
  try {
    const res=await fetch('/api/user',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({walletAddress:S.wallet,username})});
    if(res.ok){S.user=await res.json();goToLobby();}
    else $('register-error').textContent='Username already taken or server error.';
  } catch(e){ S.user={username,wallet_address:S.wallet};goToLobby(); }
  finally{$('btn-register').disabled=false;}
});

// ── Lobby ────────────────────────────────────────────────
function goToLobby() {
  clearResultTimer();
  S.sessionScore=0;
  show('lobby');
  $('lobby-welcome').textContent=`Welcome, ${S.user.username}!`;
}

document.querySelectorAll('.opp-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.opp-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); S.numOpponents=parseInt(btn.dataset.opp);
  });
});

$('btn-start').addEventListener('click', () => goToBoardSelect());
$('btn-quit-game').addEventListener('click', async () => {
  if(!confirm('Quit this game? Your session score will be saved.')) return;
  await submitSessionScore();
  window.location.href='/games/';
});

// ── Board selector ────────────────────────────────────────
const TBK_BOARDS = [
  { file:'tbk-01.jpg',       label:'Hive Table 1' },
  { file:'tbk-02.jpg',       label:'Hive Table 2' },
  { file:'universal-01.jpg', label:'Classic Table 1' },
  { file:'universal-02.png', label:'SLIME Table' },
];

function goToBoardSelect() {
  show('board-select');
  buildBoardGrid(TBK_BOARDS);
  $('btn-board-play').disabled = !S.selectedBoard;
  if (S.selectedBoard) {
    document.querySelectorAll('.board-thumb').forEach(t => {
      if ('assets/boards/'+t.dataset.file === S.selectedBoard) t.classList.add('selected');
    });
  }
}

function buildBoardGrid(boards) {
  const grid = $('board-grid'); grid.innerHTML = '';
  boards.forEach(board => {
    const thumb = document.createElement('div');
    thumb.className = 'board-thumb';
    thumb.dataset.file = board.file;
    thumb.innerHTML = `<img src="assets/boards/${board.file}" alt="${board.label}" loading="lazy" /><div class="board-label">${board.label}</div>`;
    thumb.addEventListener('click', () => {
      document.querySelectorAll('.board-thumb').forEach(t => t.classList.remove('selected'));
      thumb.classList.add('selected');
      S.selectedBoard = 'assets/boards/' + board.file;
      $('btn-board-play').disabled = false;
    });
    grid.appendChild(thumb);
  });
}

$('btn-board-back').addEventListener('click', () => goToLobby());

$('btn-board-play').addEventListener('click', async () => {
  show('dealing'); $('dealing-msg').textContent='Loading cards…';
  const cardsRes=await fetch('data/cards.json');
  S.allCards=await cardsRes.json();
  S.allCards.forEach(c=>{c.image=r2url(c.image);c.animations=c.animations.map(r2url);});
  await dealingAnimation();
  startGame();
});

// ── Dealing animation ─────────────────────────────────────
async function dealingAnimation() {
  const deckImg=$('dealing-deck').querySelector('.dealing-card-back');
  const countEl=$('dealing-deck').querySelector('.dealing-count');
  deckImg.src=R2+'/assets/backs/tbk-back.png';
  const totalDealt=10*(S.numOpponents+1);
  countEl.textContent='50';
  $('dealing-msg').textContent='Shuffling the hive…';
  await sleep(800);
  $('dealing-msg').textContent='Dealing 10 cards to each player…';
  for(let step=1;step<=10;step++){countEl.textContent=String(50-Math.round(totalDealt*step/10));await sleep(120);}
  $('dealing-msg').textContent='Choosing who goes first…';
  await sleep(900);
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

// ── Start game ───────────────────────────────────────────
function startGame(keepCaller=false) {
  clearResultTimer();
  S.frozenPile=[]; S.roundNum=0; S.roundsWon=0;
  const deck=shuffle([...S.allCards]);
  S.playerHand=deck.splice(0,10); S.oppHands=[];
  for(let i=0;i<S.numOpponents;i++) S.oppHands.push(deck.splice(0,10));
  if(!keepCaller) S.callerIndex=Math.floor(Math.random()*(S.numOpponents+1));
  show('game'); buildTableUI();
  animateCallerSelection(()=>startRound());
}

// ── Choosing-who-goes-first animation ────────────────────
function animateCallerSelection(callback) {
  const seatEls = [];
  for(let i=0;i<S.numOpponents;i++) seatEls.push($(`opp-slot-${i}`));
  seatEls.push(document.getElementById('player-zone'));

  const winnerEl = S.callerIndex===0 ? document.getElementById('player-zone') : $(`opp-slot-${S.callerIndex-1}`);

  const MS_PER_SEAT = 200;
  const CYCLES = 2;
  const totalSteps = CYCLES * seatEls.length;
  let step = 0;

  function tick() {
    seatEls.forEach(el=>{ if(el) el.classList.remove('seat-active'); });
    const el = seatEls[step % seatEls.length];
    if(el) el.classList.add('seat-active');
    step++;
    if(step < totalSteps) {
      setTimeout(tick, MS_PER_SEAT);
    } else {
      seatEls.forEach(el=>{ if(el) el.classList.remove('seat-active'); });
      setTimeout(()=>{
        if(winnerEl) winnerEl.classList.add('seat-active');
        setTimeout(()=>{
          if(winnerEl) winnerEl.classList.remove('seat-active');
          callback();
        }, 600);
      }, 150);
    }
  }
  tick();
}

// ── Build table ──────────────────────────────────────────
const TBK_OPP_AVATARS = ['tbk-opp-1.png','tbk-opp-2.png','tbk-opp-3.png','tbk-opp-4.png'];

// Seat assignments by opponent count
const SEAT_CLASSES = {
  1: ['seat-tc'],
  2: ['seat-tl', 'seat-tr'],
  3: ['seat-bl', 'seat-tl', 'seat-tr'],
  4: ['seat-bl', 'seat-tl', 'seat-tr', 'seat-br'],
};

function buildTableUI() {
  const felt = document.querySelector('.table-felt');
  // Apply selected board image to the felt container
  if (felt && S.selectedBoard) {
    felt.style.backgroundImage = `url('${S.selectedBoard}')`;
  }
  // Remove any opponent slots from a previous game
  felt.querySelectorAll('.opponent-slot').forEach(el => el.remove());
  // Build opponent seats with position class based on count
  const seats = SEAT_CLASSES[S.numOpponents];
  for (let i = 0; i < S.numOpponents; i++) {
    const avatar = TBK_OPP_AVATARS[i];
    const slot = document.createElement('div');
    slot.className = `opponent-slot ${seats[i]}`;
    slot.id = `opp-slot-${i}`;
    slot.innerHTML = `
      <img class="opp-avatar" src="assets/avatars/${avatar}" alt="Bee ${i+2}" />
      <div class="opp-identity">
        <div class="opp-stack">
          <img class="card-back-img" id="opp-back-${i}" src="${backFor(S.oppHands[i][0])}" />
          <span class="card-count" id="opp-count-${i}" title="Cards remaining in deck">${S.oppHands[i].length}</span>
        </div>
        <span class="opp-label" id="opp-label-${i}">Bee ${i+2} (${S.oppHands[i].length} cards)</span>
      </div>
      <div class="opp-active-area" id="opp-active-${i}"></div>`;
    felt.appendChild(slot);
  }
  $('player-name-label').textContent = (S.user ? S.user.username : 'You') + ` (${S.playerHand.length} cards)`;
  updatePlayerBack();
}

// ── Turn-banner helpers ──────────────────────────────────
async function showTurnBanner(name, avatarSrc, label) {
  const banner = $('turn-banner');
  banner.innerHTML = `<img class="tb-avatar" src="${avatarSrc}" alt="${name}" /><div class="tb-name">${name}</div><div class="tb-label">${label}</div>`;
  banner.classList.remove('tb-out');
  banner.classList.add('tb-in');
  banner.style.display = 'flex';
  await sleep(1700);
  banner.classList.remove('tb-in');
  banner.classList.add('tb-out');
  await sleep(350);
  banner.style.display = 'none';
  banner.classList.remove('tb-out');
}

function setCallerSeat(playerIdx) {
  clearCallerSeat();
  const el = playerIdx === 0 ? $('player-zone') : $(`opp-slot-${playerIdx-1}`);
  if (el) el.classList.add('seat-caller');
}
function clearCallerSeat() {
  document.querySelectorAll('.seat-caller').forEach(el => el.classList.remove('seat-caller'));
}

// ── Count-badge pop helper ────────────────────────────────
function popCount(el) {
  if (!el) return;
  el.classList.remove('count-pop');
  void el.offsetWidth;
  el.classList.add('count-pop');
}

// ── Round ────────────────────────────────────────────────
function startRound() {
  S.roundNum++; updateScoreBar();
  $('cards-in-play').innerHTML=''; $('player-card-area').innerHTML='';
  // Clear opponent face-up card areas from previous round
  for(let i=0;i<S.numOpponents;i++){const el=$(`opp-active-${i}`);if(el)el.innerHTML='';}
  clearContinueTimer(); clearCallerSeat();
  if(getActivePlayers().length===1){endGame();return;}
  if(playerHasCards(0)) S.callerIndex=0;
  while(!playerHasCards(S.callerIndex)) S.callerIndex=(S.callerIndex+1)%(S.numOpponents+1);
  // Decrement counts visually the moment the round begins (cards go "in play")
  updateAllCounts();
  if(S.callerIndex===0) humanCallPhase(); else computerCallPhase();
}

// ── Human turn ───────────────────────────────────────────
async function humanCallPhase() {
  const playerName = S.user ? S.user.username : 'You';
  await showTurnBanner(playerName, 'assets/avatars/tbk-player.png', 'YOUR TURN — Pick a trait!');
  setCallerSeat(0);
  const card = S.playerHand[0];
  const mb = $('message-box');
  mb.classList.add('player-turn');
  msg('Your turn! Pick the trait you want to play.');
  const cardEl = document.createElement('div'); cardEl.className = 'player-card flip-in';
  cardEl.innerHTML = `<img src="${card.image}" alt="${card.id}" onerror="this.style.background='#222'" />
    <div class="trait-list">
      ${card.traits.map((t,i) => `<button class="trait-btn" data-idx="${i}"><span class="t-name">${t.name}</span><span class="t-val">${t.value}</span></button>`).join('')}
    </div>`;
  cardEl.querySelectorAll('.trait-btn[data-idx]').forEach(btn => {
    btn.addEventListener('click', async () => {
      S.calledTraitIdx = parseInt(btn.dataset.idx);
      cardEl.querySelectorAll('.trait-btn').forEach(b => { b.disabled = true; b.style.cursor = 'default'; });
      renderPlayerFaceUp();
      renderCenterCard(0,card);
      for (let i = 0; i < S.numOpponents; i++) {
        if (S.oppHands[i].length > 0) { renderOppFaceUp(i, S.oppHands[i][0]); await sleep(300); renderCenterCard(i+1,S.oppHands[i][0]); }
      }
      msg(`You called "${card.traits[S.calledTraitIdx].name}" — ${card.traits[S.calledTraitIdx].value}. All cards revealed!`);
      await sleep(1200);
      resolveRound();
    });
  });
  $('player-card-area').appendChild(cardEl);
  hideContinue();
}

// ── Computer turn ────────────────────────────────────────
async function computerCallPhase() {
  const oppIdx = S.callerIndex - 1;
  const card = S.oppHands[oppIdx][0];
  const avatarSrc = `assets/avatars/${TBK_OPP_AVATARS[oppIdx]}`;
  await showTurnBanner(`Player ${S.callerIndex + 1}`, avatarSrc, 'is choosing a trait…');
  setCallerSeat(S.callerIndex);
  $('message-box').classList.remove('player-turn');
  msg(`Player ${S.callerIndex + 1} is thinking…`);
  await sleep(1500);
  let best = 0;
  card.traits.forEach((t, i) => { if (t.value > card.traits[best].value) best = i; });
  S.calledTraitIdx = best;
  msg(`Player ${S.callerIndex + 1} calls: "${card.traits[best].name}" — ${card.traits[best].value}. Revealing cards…`);
  renderOppFaceUp(oppIdx, card);
  renderCenterCard(S.callerIndex,card);
  await sleep(300);
  if(S.playerHand.length>0){renderPlayerFaceUp();renderCenterCard(0,S.playerHand[0]);}
  const others=[];
  for(let i=0;i<S.numOpponents;i++){if(i!==oppIdx&&S.oppHands[i].length>0)others.push(i);}
  for(const i of others){await sleep(300);renderOppFaceUp(i,S.oppHands[i][0]);renderCenterCard(i+1,S.oppHands[i][0]);}
  msg(`Player ${S.callerIndex + 1} called "${card.traits[best].name}" — ${card.traits[best].value}. All cards revealed!`);
  await sleep(1200);
  resolveRound();
}

// ── Render cards face-up ─────────────────────────────────
function renderPlayerFaceUp() {
  if(!S.playerHand.length)return;
  const card=S.playerHand[0];
  const el=document.createElement('div'); el.className='seat-card flip-in';
  el.innerHTML=`<img src="${card.image}" alt="${card.id}" onerror="this.style.background='#222'" />`;
  $('player-card-area').innerHTML=''; $('player-card-area').appendChild(el);
}

function renderOppFaceUp(oppIdx,card) {
  const el=$(`opp-active-${oppIdx}`); if(!el)return;
  el.innerHTML=`<div class="seat-card flip-in"><img src="${card.image}" alt="${card.id}" onerror="this.style.background='#333'" /></div>`;
}

// ── Center showdown card (large, in play area) ───────────────────────────────────────────
function renderCenterCard(playerIdx,card) {
  const container=$('cards-in-play');
  const name=playerIdx===0?(S.user?S.user.username:'You'):`Player ${playerIdx+1}`;
  const el=document.createElement('div'); el.className='center-card'; el.dataset.player=String(playerIdx);
  const trait=card.traits[S.calledTraitIdx];
  let total=trait.value; let xtraHtml='';
  if(typeof card.xtra!=='undefined'&&card.xtra&&card.xtra.value>0&&playerIdx!==S.callerIndex){
    total+=card.xtra.value;
    xtraHtml=`<div class="center-xtra">+XTRA: ${card.xtra.name}<span>+${card.xtra.value}</span></div>`;
  }
  el.innerHTML=`<div class="center-card-name">${name}</div>
    <img src="${card.image}" alt="${card.id}" onerror="this.style.background='#222'" />
    <div class="center-traits">
      <div class="center-trait called">${trait.name}<span>${trait.value}</span></div>
      ${xtraHtml}
      <div class="center-trait center-total">TOTAL<span>${total}</span></div>
    </div>`;
  container.appendChild(el);
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('in')));
}

function animateCenterCardsWinner(winnerIdx){
  document.querySelectorAll('.center-card').forEach(c=>{
    const p=parseInt(c.dataset.player);
    c.classList.add(p===winnerIdx?'winner':'loser');
  });
}

function dismissCenterCards(){
  const cards=document.querySelectorAll('.center-card');
  if(!cards.length)return;
  cards.forEach(c=>{c.style.transition='all 0.4s ease-out';c.style.opacity='0';c.style.transform='scale(0.8) translateY(20px)';});
  setTimeout(()=>{const cp=$('cards-in-play');if(cp)cp.innerHTML='';},400);
}

// ── Resolve round ────────────────────────────────────────
function resolveRound() {
  hideContinue(); clearContinueTimer(); clearCallerSeat();
  $('message-box').classList.remove('player-turn');
  const traitIdx=S.calledTraitIdx; const scores=[];
  // No XTRA in TBK — pure trait value comparison
  if(S.playerHand.length>0){const card=S.playerHand[0];scores.push({playerIdx:0,card,score:card.traits[traitIdx].value});}
  for(let i=0;i<S.numOpponents;i++){if(!S.oppHands[i].length)continue;const card=S.oppHands[i][0];scores.push({playerIdx:i+1,card,score:card.traits[traitIdx].value});}
  const maxScore=Math.max(...scores.map(s=>s.score));
  const winners=scores.filter(s=>s.score===maxScore); const isTie=winners.length>1;
  const roundCards=scores.map(s=>s.card);
  if(isTie){
    S.frozenPile.push(...roundCards);
    if(S.playerHand.length>0)S.playerHand.shift();
    for(let i=0;i<S.numOpponents;i++){if(S.oppHands[i].length>0)S.oppHands[i].shift();}
    const stillAlive=winners.filter(w=>playerHasCards(w.playerIdx));
    if(stillAlive.length===1){giveCardsToWinner(stillAlive[0].playerIdx,S.frozenPile);S.frozenPile=[];}
    msg(`Tie! ${S.frozenPile.length} card(s) frozen. Same caller goes again…`);
    updateAllCounts();
    dismissCenterCards();
    setTimeout(()=>startRound(), 1500);
  } else {
    const winner=winners[0]; const wi=winner.playerIdx;
    const wname=wi===0?'You':`Player ${wi+1}`;
    const won=[...roundCards,...S.frozenPile]; S.frozenPile=[];
    if(S.playerHand.length>0)S.playerHand.shift();
    for(let i=0;i<S.numOpponents;i++){if(S.oppHands[i].length>0)S.oppHands[i].shift();}
    giveCardsToWinner(wi,won); S.callerIndex=wi;
    if(wi===0){S.roundsWon++; S.sessionScore += 1000 * S.numOpponents; updateScoreBar();}
    msg(`${wname} wins the round! (${scores[0].card.traits[traitIdx].name}: ${maxScore}) — ${won.length} card(s) won.`);
    updateAllCounts();
    // Center stage: highlight winner, dismiss, then play animation (human only)
    animateCenterCardsWinner(wi);
    highlightWinnerCard(wi);
    setTimeout(()=>{
      dismissCenterCards();
      setTimeout(()=>{
        const onDone=()=>{
          if(getActivePlayers().length===1){endGame();return;}
          if(S.playerHand.length>0)renderPlayerFaceUp();
          setTimeout(()=>startRound(), 1500);
        };
        if(wi===0) playWinAnimation(winner.card,onDone);
        else onDone();
      },300);
    },1200);
  }
}

function highlightWinnerCard(wi) {
  const centerCard=document.querySelector(`.center-card[data-player="${wi}"]`);
  if(centerCard){centerCard.classList.add('card-winner');}
  // 3d: Star ping shows winning score
  const star=$('star-ping');
  star.textContent=`⭐ +${(1000*S.numOpponents).toLocaleString()}`;
  star.style.display='block';
  star.style.left=Math.random()*60+20+'%'; star.style.top=Math.random()*40+20+'%';
  setTimeout(()=>star.style.display='none',850);
}

// ── Continue / result timers ──────────────────────────────
let _continueTimer=null;
let _resultTimer=null;
function clearResultTimer(){if(_resultTimer){clearInterval(_resultTimer);_resultTimer=null;}}
function showContinue(cb){
  const btn=$('btn-continue');
  btn.style.display='block';
  $('continue-timer').textContent='';
  btn.onclick=()=>{hideContinue();cb();};
}
function hideContinue(){$('btn-continue').style.display='none';}
function clearContinueTimer(){if(_continueTimer){clearInterval(_continueTimer);_continueTimer=null;}$('continue-timer').textContent='';}

// ── Win animation ─────────────────────────────────────────
function playWinAnimation(card,callback){
  const ov=$('win-overlay'),vid=$('win-video');
  vid.src=pickAnim(card); ov.style.display='flex';
  vid.muted=false; vid.play().catch(()=>{vid.muted=true;vid.play();});
  const close=()=>{ov.style.display='none';vid.src='';ov.removeEventListener('click',close);vid.removeEventListener('ended',close);vid.removeEventListener('error',close);callback();};
  vid.addEventListener('ended',close); vid.addEventListener('error',close); ov.addEventListener('click',close);
}

// ── Submit session score to DB ────────────────────────────
async function submitSessionScore(){
  if(!S.wallet||S.sessionScore<=0)return;
  try{
    await fetch('/api/scores/tbk',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({walletAddress:S.wallet,score:S.sessionScore,opponents:S.numOpponents})});
  }catch(e){}
}

// ── End game ──────────────────────────────────────────────
async function endGame(){
  clearResultTimer();
  const humanWon=S.playerHand.length>0;
  const gamePoints=S.roundsWon*1000*S.numOpponents;
  $('result-icon').textContent=humanWon?'🏆':'💀';
  $('result-title').textContent=humanWon?'You Win!':'You Lost!';
  $('result-msg').textContent=humanWon
    ?`You beat ${S.numOpponents} opponent(s) and collected all the cards!`
    :`You won ${S.roundsWon} round(s) before the computer took all the cards.`;
  $('result-points').textContent=`+${gamePoints.toLocaleString()}`;
  $('result-total').textContent=S.sessionScore.toLocaleString();
  show('result');

  if(humanWon){
    // Win: 60s countdown to next game; quitting or timeout submits session score
    const nextBtn=$('btn-next-game');
    nextBtn.style.display=''; $('btn-view-lb').style.display='none';
    let t=60;
    const tick=()=>{nextBtn.textContent=`Next Game ▶ (${t}s)`;};
    tick();
    _resultTimer=setInterval(async()=>{
      t--;tick();
      if(t<=0){clearResultTimer();await submitSessionScore();window.location.href='/games/';}
    },1000);
    nextBtn.onclick=()=>{clearResultTimer();startGame(true);};
    $('btn-quit').onclick=async()=>{clearResultTimer();await submitSessionScore();window.location.href='/games/';};
  }else{
    // Loss: submit score immediately; offer fresh-session play-again
    await submitSessionScore();
    $('btn-next-game').textContent='Play Again'; $('btn-next-game').style.display='';
    $('btn-view-lb').style.display='';
    $('btn-next-game').onclick=()=>goToLobby();
    $('btn-view-lb').onclick=()=>loadLeaderboard();
    $('btn-quit').onclick=()=>window.location.href='/games/';
  }
}

// ── Leaderboard ───────────────────────────────────────────
async function loadLeaderboard(){
  show('leaderboard');
  try{
    const rows=await fetch('/api/leaderboard/tbk').then(r=>r.json());
    const tbody=$('lb-body'); tbody.innerHTML='';
    if(!rows.length){tbody.innerHTML='<tr><td colspan="4" style="text-align:center;color:var(--muted)">No scores yet.</td></tr>';return;}
    rows.forEach((r,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td class="lb-rank">${i+1}</td><td>${r.username}</td><td>${Number(r.score).toLocaleString()}</td><td>${r.opponents}v${r.opponents}</td>`;
      tbody.appendChild(tr);
    });
  }catch(e){$('lb-body').innerHTML='<tr><td colspan="4" style="text-align:center;color:var(--muted)">Could not load scores.</td></tr>';}
  $('btn-lb-play').onclick=()=>goToLobby();
  $('btn-lb-quit').onclick=()=>window.location.href='/games/';
}

// ── Boot ──────────────────────────────────────────────────
initAuth();
