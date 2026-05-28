/* ═══════════════════════════════════════════════════════════
   THE BEE'S KNEES  —  Game Engine  (per official rules)
   50 cards | 8 traits | NO XTRA bonus
   10 cards each | 1 human vs 1-3 computer opponents
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
  sessionScore: 0, roundNum: 0,
};

// ── DOM ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const screens = {
  auth:$('screen-auth'), register:$('screen-register'), lobby:$('screen-lobby'),
  dealing:$('screen-dealing'), game:$('screen-game'), result:$('screen-result'), leaderboard:$('screen-leaderboard')
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
function updatePlayerBack(){$('player-back').src=S.playerHand.length?backFor(S.playerHand[0]):R2+'/assets/backs/tbk-back.png';$('player-count').textContent=S.playerHand.length;}
function updateOppBack(i){const b=$(`opp-back-${i}`),c=$(`opp-count-${i}`);if(b)b.src=backFor(S.oppHands[i][0]);if(c)c.textContent=S.oppHands[i].length;}
function updateAllCounts(){updatePlayerBack();for(let i=0;i<S.numOpponents;i++)updateOppBack(i);updateScoreBar();}
function giveCardsToWinner(wi,cards){if(wi===0){S.playerHand.push(...cards);updatePlayerBack();}else{S.oppHands[wi-1].push(...cards);updateOppBack(wi-1);}}

// ── Read wallet from WalletConnect's own IndexedDB (no relay needed) ─────────
// WC v2 stores sessions in IndexedDB: db=WALLET_CONNECT_V2_INDEXED_DB, store=keyvaluestorage
function getWalletFromWC() {
  return new Promise(resolve => {
    try {
      const req = indexedDB.open('WALLET_CONNECT_V2_INDEXED_DB');
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('keyvaluestorage')) { resolve(null); return; }
        const store = db.transaction('keyvaluestorage', 'readonly').objectStore('keyvaluestorage');
        const keysReq = store.getAllKeys();
        keysReq.onerror = () => resolve(null);
        keysReq.onsuccess = () => {
          // Find the key that holds session data (contains 'session')
          const sessionKey = keysReq.result.find(k => typeof k === 'string' && k.includes('session'));
          if (!sessionKey) { resolve(null); return; }
          const valReq = store.get(sessionKey);
          valReq.onerror = () => resolve(null);
          valReq.onsuccess = () => {
            try {
              const raw = valReq.result;
              const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
              for (const session of Object.values(data || {})) {
                if (!session?.namespaces) continue;
                for (const ns of Object.values(session.namespaces)) {
                  if (ns.accounts?.length) {
                    // Account format: "chain:networkId:address"
                    const parts = ns.accounts[0].split(':');
                    resolve(parts[parts.length - 1] || null);
                    return;
                  }
                }
              }
              resolve(null);
            } catch(e) { resolve(null); }
          };
        };
      };
    } catch(e) { resolve(null); }
  });
}

// ── Auth ─────────────────────────────────────────────────
async function initAuth() {
  show('auth'); $('auth-status').textContent = 'Checking wallet…';

  // Load R2 config
  try {
    const cfg = await fetch('/api/config').then(r => r.json());
    R2 = (cfg.r2BaseUrl || '').replace(/\/$/, '') + '/tbk';
  } catch(e) {}

  // Read wallet address directly from WC's IndexedDB — instant, no network
  S.wallet = await getWalletFromWC();

  if (!S.wallet) {
    $('auth-status').innerHTML = 'Please <a href="/" style="color:var(--gold)">connect your wallet</a> on the main site first, then return here.';
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
  show('lobby');
  $('lobby-welcome').textContent=`Welcome, ${S.user.username}!`;
}

document.querySelectorAll('.opp-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.opp-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); S.numOpponents=parseInt(btn.dataset.opp);
  });
});

$('btn-start').addEventListener('click', async()=>{
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
  countEl.textContent='50';
  $('dealing-msg').textContent='Shuffling the hive…';
  await sleep(800);
  $('dealing-msg').textContent=`Dealing 10 cards to each player…`;
  for(let n=10;n>=1;n--){countEl.textContent=n*(S.numOpponents+1);await sleep(120);}
  countEl.textContent='0';
  await sleep(400);
  $('dealing-msg').textContent='Choosing who goes first…';
  await sleep(900);
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

// ── Start game ───────────────────────────────────────────
function startGame() {
  S.frozenPile=[]; S.roundNum=0;
  const deck=shuffle([...S.allCards]);
  S.playerHand=deck.splice(0,10); S.oppHands=[];
  for(let i=0;i<S.numOpponents;i++) S.oppHands.push(deck.splice(0,10));
  S.callerIndex=Math.floor(Math.random()*(S.numOpponents+1));
  show('game'); buildTableUI(); startRound();
}

// ── Build table ──────────────────────────────────────────
const BEE_AVATARS = ['bee-1.png','bee-3.png','bee-8.png','bee-19.png'];

function buildTableUI() {
  const oz=$('opponents-zone'); oz.innerHTML='';
  for(let i=0;i<S.numOpponents;i++){
    const avatar=BEE_AVATARS[i % BEE_AVATARS.length];
    const slot=document.createElement('div'); slot.className='opponent-slot'; slot.id=`opp-slot-${i}`;
    slot.innerHTML=`
      <img class="opp-avatar" src="assets/avatars/${avatar}" alt="Bee ${i+2}" />
      <div class="opp-identity">
        <div class="opp-stack">
          <img class="card-back-img" id="opp-back-${i}" src="${backFor(S.oppHands[i][0])}" />
          <span class="card-count" id="opp-count-${i}">${S.oppHands[i].length}</span>
        </div>
        <span class="opp-label" id="opp-label-${i}">Bee ${i+2}</span>
      </div>
      <div class="opp-active-area" id="opp-active-${i}"></div>`;
    oz.appendChild(slot);
  }
  $('player-name-label').textContent=S.user?S.user.username:'You';
  updatePlayerBack();
}

// ── Round ────────────────────────────────────────────────
function startRound() {
  S.roundNum++; updateScoreBar();
  $('cards-in-play').innerHTML=''; $('player-card-area').innerHTML='';
  // Clear opponent face-up card areas from previous round
  for(let i=0;i<S.numOpponents;i++){const el=$(`opp-active-${i}`);if(el)el.innerHTML='';}
  clearContinueTimer();
  if(getActivePlayers().length===1){endGame();return;}
  while(!playerHasCards(S.callerIndex)) S.callerIndex=(S.callerIndex+1)%(S.numOpponents+1);
  if(S.callerIndex===0) humanCallPhase(); else computerCallPhase();
}

// ── Human turn ───────────────────────────────────────────
function humanCallPhase() {
  const card=S.playerHand[0];
  msg('Your turn! Pick the trait you want to play.');
  const cardEl=document.createElement('div'); cardEl.className='player-card flip-in';
  cardEl.innerHTML=`<img src="${card.image}" alt="${card.id}" onerror="this.style.background='#222'" />
    <div class="trait-list">
      ${card.traits.map((t,i)=>`<button class="trait-btn" data-idx="${i}"><span class="t-name">${t.name}</span><span class="t-val">${t.value}</span></button>`).join('')}
    </div>`;
  cardEl.querySelectorAll('.trait-btn[data-idx]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      S.calledTraitIdx=parseInt(btn.dataset.idx);
      // Disable further clicks
      cardEl.querySelectorAll('.trait-btn').forEach(b=>{b.disabled=true;b.style.cursor='default';});
      // Highlight chosen trait on player card
      renderPlayerFaceUp();
      // Reveal all opponent cards face-up
      for(let i=0;i<S.numOpponents;i++){
        if(S.oppHands[i].length>0) renderOppFaceUp(i,S.oppHands[i][0],false);
      }
      msg(`You called "${card.traits[S.calledTraitIdx].name}" — ${card.traits[S.calledTraitIdx].value}. All cards revealed!`);
      showContinue(()=>resolveRound());
    });
  });
  $('player-card-area').appendChild(cardEl);
  hideContinue();
}

// ── Computer turn ────────────────────────────────────────
function computerCallPhase() {
  const oppIdx=S.callerIndex-1; const card=S.oppHands[oppIdx][0];
  let best=0; card.traits.forEach((t,i)=>{if(t.value>card.traits[best].value)best=i;});
  S.calledTraitIdx=best;
  msg(`Player ${S.callerIndex+1} calls: "${card.traits[best].name}" — ${card.traits[best].value}. All cards revealed…`);
  renderOppFaceUp(oppIdx,card,true); renderPlayerFaceUp();
  for(let i=0;i<S.numOpponents;i++){if(i!==oppIdx&&S.oppHands[i].length>0)renderOppFaceUp(i,S.oppHands[i][0],false);}
  showContinue(()=>resolveRound());
}

// ── Render cards face-up ─────────────────────────────────
function renderPlayerFaceUp() {
  if(!S.playerHand.length)return;
  const card=S.playerHand[0];
  const el=document.createElement('div'); el.className='player-card flip-in';
  el.innerHTML=`<img src="${card.image}" alt="${card.id}" onerror="this.style.background='#222'" />
    <div class="trait-list">
      ${card.traits.map((t,i)=>`<div class="trait-btn${i===S.calledTraitIdx?' highlighted':''}" style="pointer-events:none"><span class="t-name">${t.name}</span><span class="t-val">${t.value}</span></div>`).join('')}
    </div>`;
  $('player-card-area').innerHTML=''; $('player-card-area').appendChild(el);
}

function renderOppFaceUp(oppIdx,card,isCaller) {
  const el=$(`opp-active-${oppIdx}`); if(!el)return;
  el.innerHTML=`<div class="opp-face-card flip-in">
    <div class="opp-name">Player ${oppIdx+2}</div>
    <img src="${card.image}" alt="${card.id}" onerror="this.style.background='#333'" />
    ${card.traits.map((t,i)=>`<div class="opp-trait-row${i===S.calledTraitIdx?' called':''}">${t.name}<span>${t.value}</span></div>`).join('')}
  </div>`;
}

// ── Resolve round ────────────────────────────────────────
function resolveRound() {
  hideContinue(); clearContinueTimer();
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
    updateAllCounts(); showContinue(()=>startRound());
  } else {
    const winner=winners[0]; const wi=winner.playerIdx;
    const wname=wi===0?'You':`Player ${wi+1}`;
    const won=[...roundCards,...S.frozenPile]; S.frozenPile=[];
    if(S.playerHand.length>0)S.playerHand.shift();
    for(let i=0;i<S.numOpponents;i++){if(S.oppHands[i].length>0)S.oppHands[i].shift();}
    giveCardsToWinner(wi,won); S.callerIndex=wi;
    msg(`${wname} wins the round! (${scores[0].card.traits[traitIdx].name}: ${maxScore}) — ${won.length} card(s) won.`);
    updateAllCounts();
    highlightWinnerCard(wi);
    setTimeout(()=>{
      playWinAnimation(winner.card,()=>{
        if(getActivePlayers().length===1){endGame();return;}
        if(S.playerHand.length>0)renderPlayerFaceUp();
        showContinue(()=>startRound());
      });
    }, 600);
  }
}

function highlightWinnerCard(wi) {
  if(wi===0){const c=$('player-card-area').querySelector('.player-card');if(c)c.classList.add('card-winner');}
  else{const c=$(`opp-active-${wi-1}`).querySelector('.opp-face-card');if(c)c.classList.add('card-winner');}
  const star=$('star-ping'); star.style.display='block';
  star.style.left=Math.random()*60+20+'%'; star.style.top=Math.random()*40+20+'%';
  setTimeout(()=>star.style.display='none',850);
}

// ── Continue button + countdown ───────────────────────────
let _continueTimer=null;
function showContinue(cb){
  const btn=$('btn-continue'); btn.style.display='block';
  let t=10; $('continue-timer').textContent=`(${t}s)`;
  btn.onclick=()=>{clearContinueTimer();cb();};
  _continueTimer=setInterval(()=>{t--;$('continue-timer').textContent=`(${t}s)`;if(t<=0){clearContinueTimer();cb();}},1000);
}
function hideContinue(){$('btn-continue').style.display='none';}
function clearContinueTimer(){if(_continueTimer){clearInterval(_continueTimer);_continueTimer=null;}$('continue-timer').textContent='';}

// ── Win animation ─────────────────────────────────────────
function playWinAnimation(card,callback){
  const ov=$('win-overlay'),vid=$('win-video');
  vid.src=pickAnim(card); ov.style.display='flex';
  vid.muted=false; vid.play().catch(()=>{vid.muted=true;vid.play();});
  const close=()=>{ov.style.display='none';vid.src='';ov.removeEventListener('click',close);vid.removeEventListener('ended',close);callback();};
  vid.addEventListener('ended',close); ov.addEventListener('click',close);
}

// ── End game ──────────────────────────────────────────────
async function endGame(){
  const humanWon=S.playerHand.length>0;
  const points=humanWon?1000*S.numOpponents:0;
  S.sessionScore+=points;
  if(S.wallet&&humanWon){
    fetch('/api/scores/tbk',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({walletAddress:S.wallet,score:points,opponents:S.numOpponents})}).catch(()=>{});
  }
  $('result-icon').textContent=humanWon?'🏆':'💀';
  $('result-title').textContent=humanWon?'You Win!':'You Lost!';
  $('result-msg').textContent=humanWon?`You beat ${S.numOpponents} opponent(s) and collected all the cards!`:'Better luck next time — the computer took all the cards.';
  $('result-points').textContent=`+${points.toLocaleString()}`;
  $('result-total').textContent=S.sessionScore.toLocaleString();
  show('result');
  $('btn-next-game').onclick=()=>{S.callerIndex=0;startGame();};
  $('btn-view-lb').onclick=()=>loadLeaderboard();
  $('btn-quit').onclick=()=>window.location.href='/games/';
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
