/* ═══════════════════════════════════════════════════════
   APE-MOD-X  —  Game Engine  (per official PDF rules)
   150 cards | Couture / Mutants / Mecha mixed
   10 cards each | 5 traits + XTRA defence bonus
   1 human vs 1-4 computer opponents
═══════════════════════════════════════════════════════ */
'use strict';

// ── Config ───────────────────────────────────────────────
let R2 = '';
function r2url(p) { return R2 + '/' + p.replace(/#/g, '%23'); }

// ── State ────────────────────────────────────────────────
const S = {
  user: null, wallet: null, allCards: [],
  numOpponents: 1, playerHand: [], oppHands: [],
  frozenPile: [], callerIndex: -1, calledTraitIdx: -1,
  sessionScore: 0, gameScore: 0, tiePlayers: null, roundNum: 0, roundsWon: 0, continueTimer: null,
  selectedBoard: null,
};

// ── DOM ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const screens = { auth:$('screen-auth'), register:$('screen-register'), lobby:$('screen-lobby'),
  'board-select':$('screen-board-select'), dealing:$('screen-dealing'),
  game:$('screen-game'), result:$('screen-result'), leaderboard:$('screen-leaderboard') };

function show(name) {
  Object.values(screens).forEach(s => { s.style.display='none'; s.classList.remove('active'); });
  screens[name].style.display='flex'; screens[name].classList.add('active');
}

// ── Helpers ──────────────────────────────────────────────
function shuffle(arr) {
  const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a;
}
function pickAnim(c){const a=c.animations;return a[Math.floor(Math.random()*a.length)];}
function backFor(c){
  if(!c) return R2+'/assets/backs/couture-back.png';
  if(c.deck==='Mutants') return R2+'/assets/backs/mutants-back.png';
  if(c.deck==='Mecha')   return R2+'/assets/backs/mecha-back.png';
  return R2+'/assets/backs/couture-back.png';
}
function msg(t){$('message-box').textContent=t;}
function updateScoreBar(){$('round-info').textContent=`Round ${S.roundNum}`;$('session-score').textContent=`Score: ${S.sessionScore.toLocaleString()}`;}
function playerHasCards(idx){return idx===0?S.playerHand.length>0:S.oppHands[idx-1].length>0;}
function getActivePlayers(){const a=[];if(S.playerHand.length>0)a.push(0);S.oppHands.forEach((h,i)=>{if(h.length>0)a.push(i+1);});return a;}
function updatePlayerBack(){const t=S.playerHand[0];$('player-back').src=t?backFor(t):R2+'/assets/backs/couture-back.png';const pc=$('player-count');pc.textContent=S.playerHand.length;pc.title='Cards remaining in deck';const pl=$('player-name-label');if(pl)pl.textContent=(S.user?S.user.username:'You')+` (${S.playerHand.length} cards)`;}
function updateOppBack(i){const b=$(`opp-back-${i}`),c=$(`opp-count-${i}`),l=$(`opp-name-${i}`);if(b)b.src=S.oppHands[i].length?backFor(S.oppHands[i][0]):R2+'/assets/backs/couture-back.png';if(c){c.textContent=S.oppHands[i].length;c.title='Cards remaining in deck';}if(l)l.textContent=`Player ${i+2} (${S.oppHands[i].length} cards)`;}
function updateAllCounts(){updatePlayerBack();for(let i=0;i<S.numOpponents;i++)updateOppBack(i);updateScoreBar();}
function giveCardsToWinner(wi,cards){if(wi===0){S.playerHand.push(...cards);updatePlayerBack();}else{S.oppHands[wi-1].push(...cards);updateOppBack(wi-1);}}

// getWalletFromWC() is provided by /js/wallet-utils.js

// ── Auth ─────────────────────────────────────────────────
let _walletProjectId = '';

async function checkXrplNftGate(address) {
  const AMX_TAXON = 777;
  try {
    const res = await fetch('https://xrplcluster.com/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'account_nfts', params: [{ account: address }] })
    });
    const data = await res.json();
    const nfts = data.result?.account_nfts || [];
    return nfts.some(nft => nft.NFTokenTaxon === AMX_TAXON);
  } catch (e) {
    console.error('[Gate] XRPL NFT check failed:', e);
    return false;
  }
}

async function initAuth() {
  show('auth');
  $('auth-status').textContent = 'Checking wallet…';
  $('btn-connect-wallet').style.display = 'none';

  // Load R2 config + wallet credentials
  try {
    const cfg = await fetch('/api/config').then(r => r.json());
    R2 = (cfg.r2BaseUrl || '').replace(/\/$/, '') + '/apemodx';
    _walletProjectId = cfg.walletConnectProjectId || '';
    if (cfg.xamanApiKey) initWalletSelector(cfg.xamanApiKey);
  } catch(e) {}

  // Try existing WalletConnect session
  const wcInfo = await getWalletInfoFromWC();
  if (wcInfo && wcInfo.address) {
    S.wallet = wcInfo.address;
    const hasNft = await checkXrplNftGate(S.wallet);
    if (!hasNft) {
      $('auth-status').textContent = 'You need an Ape-Mod-X NFT to play.';
      $('btn-connect-wallet').style.display = '';
      return;
    }
    await _loadUserAndGo();
    return;
  }

  // Try existing Xaman session (localStorage first, then SDK ready event)
  if (_xamanApiKey) {
    try {
      const account = await getXamanAccount(_xamanApiKey);
      if (account) {
        S.wallet = account;
        const hasNft = await checkXrplNftGate(S.wallet);
        if (!hasNft) {
          $('auth-status').textContent = 'You need an Ape-Mod-X NFT to play.';
          $('btn-connect-wallet').style.display = '';
          return;
        }
        await _loadUserAndGo();
        return;
      }
    } catch (e) {}
  }

  // No wallet — show connect button
  $('auth-status').textContent = 'Connect your wallet to play Ape-Mod-X.';
  $('btn-connect-wallet').style.display = '';
}

async function _loadUserAndGo() {
  try {
    const res = await fetch(`/api/user/${S.wallet}`);
    if (res.ok) { S.user = await res.json(); goToLobby(); }
    else show('register');
  } catch (e) {
    S.user = { username: 'Guest', wallet_address: S.wallet };
    goToLobby();
  }
}

$('btn-connect-wallet').addEventListener('click', async () => {
  const btn = $('btn-connect-wallet');
  btn.disabled = true; btn.textContent = 'Connecting…';
  $('auth-status').textContent = 'Opening wallet selector…';

  try {
    const result = await showWalletSelector(_walletProjectId);
    S.wallet = result.address;

    // XRPL token gate
    const hasNft = await checkXrplNftGate(S.wallet);
    if (!hasNft) {
      $('auth-status').textContent = 'You need an Ape-Mod-X NFT (Taxon 777) to play.';
      btn.disabled = false; btn.textContent = 'Connect Wallet';
      return;
    }

    await _loadUserAndGo();
  } catch (e) {
    console.error('[Auth] Wallet connection failed:', e);
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
  S.sessionScore=0; S.gameScore=0; S.tiePlayers=null;
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
$('btn-quit-game').addEventListener('click', () => {
  const modal=$('quit-modal'), backdrop=modal.querySelector('.quit-modal-backdrop');
  const cancelBtn=$('btn-quit-cancel'), confirmBtn=$('btn-quit-confirm');
  const hide=()=>{modal.style.display='none';};
  const onCancel=()=>{hide(); cancelBtn.removeEventListener('click',onCancel); confirmBtn.removeEventListener('click',onConfirm); backdrop.removeEventListener('click',onCancel);};
  const onConfirm=async()=>{hide(); cancelBtn.removeEventListener('click',onCancel); confirmBtn.removeEventListener('click',onConfirm); backdrop.removeEventListener('click',onCancel); await submitSessionScore(); window.location.href='/games/';};
  modal.style.display='flex';
  cancelBtn.addEventListener('click',onCancel);
  confirmBtn.addEventListener('click',onConfirm);
  backdrop.addEventListener('click',onCancel);
});

// ── Board selector ────────────────────────────────────────
const AMX_BOARDS = [
  { file:'ape-01.png',       label:'Ape Table 1' },
  { file:'ape-02.jpg',       label:'Ape Table 2' },
  { file:'ape-03.jpg',       label:'Ape Table 3' },
  { file:'ape-04.jpg',       label:'Ape Table 4' },
  { file:'ape-05.jpg',       label:'Ape Table 5' },
  { file:'ape-06.png',       label:'Ape Table 6' },
  { file:'ape-07.png',       label:'Ape Table 7' },
  { file:'ape-08.png',       label:'Ape Table 8' },
  { file:'ape-09.jpg',       label:'Ape Table 9' },
  { file:'ape-10.jpg',       label:'Ape Table 10' },
  { file:'universal-01.jpg', label:'Classic Table 1' },
  { file:'universal-02.png', label:'SLIME Table' },
];

function goToBoardSelect() {
  show('board-select');
  buildBoardGrid(AMX_BOARDS);
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
  deckImg.src=R2+'/assets/backs/couture-back.png';
  const totalDealt=10*(S.numOpponents+1);
  countEl.textContent='150';
  $('dealing-msg').textContent='Shuffling the deck…';
  await sleep(800);
  $('dealing-msg').textContent='Dealing 10 cards to each player…';
  for(let step=1;step<=10;step++){countEl.textContent=String(150-Math.round(totalDealt*step/10));await sleep(120);}
  $('dealing-msg').textContent='Choosing who goes first…';
  await sleep(900);
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

// ── Start game ───────────────────────────────────────────
function startGame(keepCaller=false) {
  clearResultTimer();
  S.frozenPile=[]; S.roundNum=0; S.roundsWon=0; S.gameScore=0; S.tiePlayers=null;
  const deck=shuffle([...S.allCards]);
  S.playerHand=deck.splice(0,10); S.oppHands=[];
  for(let i=0;i<S.numOpponents;i++) S.oppHands.push(deck.splice(0,10));
  if(!keepCaller) S.callerIndex=0;
  show('game'); buildTableUI();
  animateCallerSelection(()=>startRound());
}

// ── Choosing-who-goes-first animation ────────────────────
function animateCallerSelection(callback) {
  // Build ordered list of seat elements: opps (0..n-1) then human
  const seats = SEAT_CLASSES[S.numOpponents];
  const seatEls = [];
  for(let i=0;i<S.numOpponents;i++) seatEls.push($(`opp-slot-${i}`));
  seatEls.push(document.getElementById('player-zone'));

  // callerIndex 0 = human (last in seatEls), 1..n = opp i-1
  const winnerEl = S.callerIndex===0 ? document.getElementById('player-zone') : $(`opp-slot-${S.callerIndex-1}`);

  const MS_PER_SEAT = 200;
  const CYCLES = 2;
  const totalSteps = CYCLES * seatEls.length;
  let step = 0;

  function tick() {
    // Remove highlight from all
    seatEls.forEach(el=>{ if(el) el.classList.remove('seat-active'); });
    const el = seatEls[step % seatEls.length];
    if(el) el.classList.add('seat-active');
    step++;
    if(step < totalSteps) {
      setTimeout(tick, MS_PER_SEAT);
    } else {
      // Final settle: remove cycling highlight, land on winner
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

// ── Build table ───────────────────────────────────────────
// Seat assignments by opponent count
const SEAT_CLASSES = {
  1: ['seat-tc'],
  2: ['seat-tl', 'seat-tr'],
  3: ['seat-bl', 'seat-tl', 'seat-tr'],
  4: ['seat-bl', 'seat-tl', 'seat-tr', 'seat-br'],
};

const AMX_OPP_AVATARS = [
  'assets/avatars/amx-opp-1.png',
  'assets/avatars/amx-opp-2.png',
  'assets/avatars/amx-opp-3.png',
  'assets/avatars/amx-opp-4.png',
];

function buildTableUI() {
  const felt = document.querySelector('.table-felt');
  // Apply selected board image
  if (felt && S.selectedBoard) {
    felt.style.backgroundImage = `url('${S.selectedBoard}')`;
  }
  // Remove any opponent slots from a previous game
  felt.querySelectorAll('.opponent-slot').forEach(el => el.remove());
  // Build opponent seats with position class based on count
  const seats = SEAT_CLASSES[S.numOpponents];
  for (let i = 0; i < S.numOpponents; i++) {
    const avatar = AMX_OPP_AVATARS[i];
    const slot = document.createElement('div');
    slot.className = `opponent-slot ${seats[i]}`;
    slot.id = `opp-slot-${i}`;
    slot.innerHTML = `
      <img class="opp-avatar" src="${avatar}" alt="Player ${i+2}" />
      <div class="opp-identity">
        <div class="opp-stack">
          <img class="card-back-img" id="opp-back-${i}" src="${backFor(S.oppHands[i][0])}" />
          <span class="card-count" id="opp-count-${i}" title="Cards remaining in deck">${S.oppHands[i].length}</span>
        </div>
        <span class="opp-label" id="opp-name-${i}">Player ${i+2} (${S.oppHands[i].length} cards)</span>
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
  for(let i=0;i<S.numOpponents;i++){const el=$(`opp-active-${i}`);if(el)el.innerHTML='';}
  clearContinueTimer(); clearCallerSeat();
  if(getActivePlayers().length===1){endGame();return;}
  if(S.tiePlayers){
    while(!playerHasCards(S.callerIndex)||!S.tiePlayers.includes(S.callerIndex)) S.callerIndex=(S.callerIndex+1)%(S.numOpponents+1);
  }else{
    while(!playerHasCards(S.callerIndex)) S.callerIndex=(S.callerIndex+1)%(S.numOpponents+1);
  }
  // Decrement counts visually the moment the round begins (cards go "in play")
  updateAllCounts();
  if(S.callerIndex===0) humanCallPhase(); else computerCallPhase();
}

// ── Human turn ───────────────────────────────────────────
async function humanCallPhase() {
  const playerName = S.user ? S.user.username : 'You';
  await showTurnBanner(playerName, 'assets/avatars/amx-player.png', 'YOUR TURN — Pick a trait!');
  setCallerSeat(0);
  const card = S.playerHand[0];
  const mb = $('message-box');
  mb.classList.add('player-turn');
  msg('Your turn! Pick a trait to play. (As caller, your XTRA does not apply this round.)');
  const cardEl = document.createElement('div'); cardEl.className = 'player-card flip-in';
  cardEl.innerHTML = `<img src="${card.image}" alt="${card.id}" onerror="this.style.background='#222'" />
    <div class="trait-list">
      ${card.traits.map((t,i) => `<button class="trait-btn" data-idx="${i}"><span class="t-name">${t.name}</span><span class="t-val">${t.value}</span></button>`).join('')}
      <div class="trait-btn xtra-row"><span class="t-name">XTRA: ${card.xtra.name}</span><span class="t-val">${card.xtra.value}</span></div>
    </div>`;
  cardEl.querySelectorAll('.trait-btn[data-idx]').forEach(btn => {
    btn.addEventListener('click', async () => {
      S.calledTraitIdx = parseInt(btn.dataset.idx);
      cardEl.querySelectorAll('.trait-btn').forEach(b => { b.disabled = true; b.style.cursor = 'default'; });
      renderPlayerFaceUp();
      renderCenterCard(0,card);
      for (let i = 0; i < S.numOpponents; i++) {
        if (S.oppHands[i].length > 0 && (!S.tiePlayers || S.tiePlayers.includes(i + 1))) { renderOppFaceUp(i, S.oppHands[i][0]); await sleep(300); renderCenterCard(i+1,S.oppHands[i][0]); }
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
  const avatarSrc = AMX_OPP_AVATARS[oppIdx];
  await showTurnBanner(`Player ${S.callerIndex + 1}`, avatarSrc, 'is choosing a trait…');
  setCallerSeat(S.callerIndex);
  $('message-box').classList.remove('player-turn');
  msg(`Player ${S.callerIndex + 1} is thinking…`);
  await sleep(1500);
  let best = 0;
  card.traits.forEach((t,i) => { if(t.value > card.traits[best].value) best = i; });
  S.calledTraitIdx = best;
  msg(`Player ${S.callerIndex + 1} calls: "${card.traits[best].name}" — ${card.traits[best].value}. Revealing cards…`);
  renderOppFaceUp(oppIdx, card);
  renderCenterCard(S.callerIndex,card);
  await sleep(300);
  if(S.playerHand.length>0 && (!S.tiePlayers || S.tiePlayers.includes(0))){renderPlayerFaceUp();renderCenterCard(0,S.playerHand[0]);}
  const others=[];
  for(let i=0;i<S.numOpponents;i++){if(i!==oppIdx&&S.oppHands[i].length>0&&(!S.tiePlayers||S.tiePlayers.includes(i+1)))others.push(i);}
  for(const i of others){await sleep(300);renderOppFaceUp(i,S.oppHands[i][0]);renderCenterCard(i+1,S.oppHands[i][0]);}
  msg(`Player ${S.callerIndex + 1} called "${card.traits[best].name}" — ${card.traits[best].value}. All cards revealed!`);
  await sleep(1200);
  resolveRound();
}

// ── Render cards face-up ──────────────────────────────────
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

// ── Center showdown card (large, in play area) ──────────────────────────────────────
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
  // In tie-breaker, only tied players compete
  if(S.tiePlayers){
    if(S.playerHand.length>0&&S.tiePlayers.includes(0)){
      const card=S.playerHand[0];const base=card.traits[traitIdx].value;const xtra=S.callerIndex!==0?card.xtra.value:0;
      scores.push({playerIdx:0,card,score:base+xtra});
    }
    for(let i=0;i<S.numOpponents;i++){
      if(!S.oppHands[i].length||!S.tiePlayers.includes(i+1))continue;
      const card=S.oppHands[i][0];const base=card.traits[traitIdx].value;const xtra=S.callerIndex!==i+1?card.xtra.value:0;
      scores.push({playerIdx:i+1,card,score:base+xtra});
    }
  }else{
    if(S.playerHand.length>0){const card=S.playerHand[0];const base=card.traits[traitIdx].value;const xtra=S.callerIndex!==0?card.xtra.value:0;scores.push({playerIdx:0,card,score:base+xtra});}
    for(let i=0;i<S.numOpponents;i++){if(!S.oppHands[i].length)continue;const card=S.oppHands[i][0];const base=card.traits[traitIdx].value;const xtra=S.callerIndex!==i+1?card.xtra.value:0;scores.push({playerIdx:i+1,card,score:base+xtra});}
  }
  const maxScore=Math.max(...scores.map(s=>s.score));
  const winners=scores.filter(s=>s.score===maxScore); const isTie=winners.length>1;
  const roundCards=scores.map(s=>s.card);
  if(isTie){
    S.frozenPile.push(...roundCards);
    if(S.tiePlayers){
      if(S.playerHand.length>0&&S.tiePlayers.includes(0))S.playerHand.shift();
      for(let i=0;i<S.numOpponents;i++){if(S.oppHands[i].length>0&&S.tiePlayers.includes(i+1))S.oppHands[i].shift();}
    }else{
      if(S.playerHand.length>0)S.playerHand.shift();
      for(let i=0;i<S.numOpponents;i++){if(S.oppHands[i].length>0)S.oppHands[i].shift();}
    }
    const stillAlive=winners.filter(w=>playerHasCards(w.playerIdx));
    if(stillAlive.length===1){
      const wi=stillAlive[0].playerIdx;
      giveCardsToWinner(wi,S.frozenPile);S.frozenPile=[];
      const wname=wi===0?(S.user?S.user.username:'You'):`Player ${wi+1}`;
      const roundPoints=1000*(scores.length-1);
      if(wi===0){S.roundsWon++; S.sessionScore+=roundPoints; S.gameScore+=roundPoints;}
      msg(`${wname} wins by default — other tied players out of cards!`);
      S.tiePlayers=null;
      updateAllCounts();
      animateCenterCardsWinner(wi);
      highlightWinnerCard(wi,roundPoints);
      setTimeout(()=>{
        dismissCenterCards();
        setTimeout(()=>{
          const onDone=()=>{
            if(getActivePlayers().length===1){endGame();return;}
            if(S.playerHand.length>0)renderPlayerFaceUp();
            setTimeout(()=>startRound(),1500);
          };
          if(wi===0) playWinAnimation(stillAlive[0].card,onDone);
          else onDone();
        },300);
      },1200);
      return;
    }
    S.tiePlayers=winners.map(w=>w.playerIdx);
    msg(`Tie! ${S.tiePlayers.length} players tied. Tie-breaker round…`);
    updateAllCounts();
    dismissCenterCards();
    setTimeout(()=>startRound(),1500);
  }else{
    const winner=winners[0]; const wi=winner.playerIdx;
    const wname=wi===0?(S.user?S.user.username:'You'):`Player ${wi+1}`;
    const won=[...roundCards,...S.frozenPile]; S.frozenPile=[];
    if(S.tiePlayers){
      if(S.playerHand.length>0&&S.tiePlayers.includes(0))S.playerHand.shift();
      for(let i=0;i<S.numOpponents;i++){if(S.oppHands[i].length>0&&S.tiePlayers.includes(i+1))S.oppHands[i].shift();}
    }else{
      if(S.playerHand.length>0)S.playerHand.shift();
      for(let i=0;i<S.numOpponents;i++){if(S.oppHands[i].length>0)S.oppHands[i].shift();}
    }
    giveCardsToWinner(wi,won); S.callerIndex=wi;
    const roundPoints=1000*(scores.length-1);
    if(wi===0){S.roundsWon++; S.sessionScore+=roundPoints; S.gameScore+=roundPoints;}
    msg(`${wname} wins the round! (${scores[0].card.traits[traitIdx].name}: ${maxScore}) — ${won.length} card(s) won.`);
    updateAllCounts();
    animateCenterCardsWinner(wi);
    highlightWinnerCard(wi,roundPoints);
    setTimeout(()=>{
      dismissCenterCards();
      setTimeout(()=>{
        const onDone=()=>{
          S.tiePlayers=null;
          if(getActivePlayers().length===1){endGame();return;}
          if(S.playerHand.length>0)renderPlayerFaceUp();
          setTimeout(()=>startRound(),1500);
        };
        if(wi===0) playWinAnimation(winner.card,onDone);
        else onDone();
      },300);
    },1200);
  }
}

function highlightWinnerCard(wi,points) {
  const centerCard=document.querySelector(`.center-card[data-player="${wi}"]`);
  if(centerCard){centerCard.classList.add('card-winner');}
  // 3d: Star ping shows winning score
  const star=$('star-ping');
  star.textContent=`⭐ +${points.toLocaleString()}`;
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
    await fetch('/api/scores/amx',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({walletAddress:S.wallet,score:S.sessionScore,opponents:S.numOpponents})});
  }catch(e){}
}

// ── End game ──────────────────────────────────────────────
async function endGame(){
  clearResultTimer();
  const humanWon=S.playerHand.length>0;
  const gamePoints=S.gameScore;
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
async function loadLeaderboard(opponents){
  show('leaderboard');
  try{
    const url='/api/leaderboard/amx'+(opponents?'?opponents='+opponents:'');
    const rows=await fetch(url).then(r=>r.json());
    const tbody=$('lb-body'); tbody.innerHTML='';
    if(!rows.length){tbody.innerHTML='<tr><td colspan="4" style="text-align:center;color:var(--muted)">No scores yet.</td></tr>';return;}
    rows.forEach((r,i)=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td class="lb-rank">${i+1}</td><td>${r.username}</td><td>${Number(r.score).toLocaleString()}</td><td>${r.opponents+1}</td>`;
      tbody.appendChild(tr);
    });
  }catch(e){$('lb-body').innerHTML='<tr><td colspan="4" style="text-align:center;color:var(--muted)">Could not load scores.</td></tr>';}
  document.querySelectorAll('#screen-leaderboard .lb-filter-btn').forEach(btn=>{
    btn.onclick=()=>{
      document.querySelectorAll('#screen-leaderboard .lb-filter-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      loadLeaderboard(btn.dataset.opp||'');
    };
  });
  $('btn-lb-play').onclick=()=>goToLobby();
  $('btn-lb-quit').onclick=()=>window.location.href='/games/';
}

// ── Boot ──────────────────────────────────────────────────
initAuth();
