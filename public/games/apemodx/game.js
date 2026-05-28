/* ═══════════════════════════════════════════════════════
   APE-MOD-X  —  Game Engine  (per official PDF rules)
   150 cards | Couture / Mutants / Mecha mixed
   10 cards each | 5 traits + XTRA defence bonus
   1 human vs 1-3 computer opponents
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
  sessionScore: 0, roundNum: 0, continueTimer: null,
};

// ── DOM ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const screens = { auth:$('screen-auth'), register:$('screen-register'), lobby:$('screen-lobby'),
  dealing:$('screen-dealing'), game:$('screen-game'), result:$('screen-result'), leaderboard:$('screen-leaderboard') };

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
function updatePlayerBack(){const t=S.playerHand[0];$('player-back').src=t?backFor(t):R2+'/assets/backs/couture-back.png';$('player-count').textContent=S.playerHand.length;}
function updateOppBack(i){const b=$(`opp-back-${i}`),c=$(`opp-count-${i}`);if(b)b.src=S.oppHands[i].length?backFor(S.oppHands[i][0]):R2+'/assets/backs/couture-back.png';if(c)c.textContent=S.oppHands[i].length;}
function updateAllCounts(){updatePlayerBack();for(let i=0;i<S.numOpponents;i++)updateOppBack(i);updateScoreBar();}
function giveCardsToWinner(wi,cards){if(wi===0){S.playerHand.push(...cards);updatePlayerBack();}else{S.oppHands[wi-1].push(...cards);updateOppBack(wi-1);}}

// ── Auth ─────────────────────────────────────────────────
async function initAuth() {
  show('auth'); $('auth-status').textContent='Checking wallet…';
  try { const cfg=await fetch('/api/config').then(r=>r.json()); R2=(cfg.r2BaseUrl||'').replace(/\/$/,'')+'/apemodx'; } catch(e){}
  S.wallet=localStorage.getItem('gbg_wallet');
  if(!S.wallet){
    $('auth-status').innerHTML='Please <a href="/" style="color:var(--gold)">connect your wallet</a> on the main site first.';
    return;
  }
  try {
    const res=await fetch(`/api/user/${S.wallet}`);
    if(res.ok){S.user=await res.json();goToLobby();}
    else show('register');
  } catch(e){ S.user={username:'Guest',wallet_address:S.wallet}; goToLobby(); }
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
  deckImg.src=R2+'/assets/backs/couture-back.png';
  countEl.textContent='150';
  $('dealing-msg').textContent='Shuffling the deck…';
  await sleep(800);
  $('dealing-msg').textContent=`Dealing 10 cards to each player…`;
  for(let n=10;n>=1;n--){countEl.textContent=n*((S.numOpponents+1));await sleep(120);}
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

// ── Build table ───────────────────────────────────────────
function buildTableUI() {
  const oz=$('opponents-zone'); oz.innerHTML='';
  for(let i=0;i<S.numOpponents;i++){
    const slot=document.createElement('div'); slot.className='opponent-slot'; slot.id=`opp-slot-${i}`;
    slot.innerHTML=`<div class="opp-stack"><img class="card-back-img" id="opp-back-${i}" src="${backFor(S.oppHands[i][0])}" /><span class="card-count" id="opp-count-${i}">${S.oppHands[i].length}</span></div><div id="opp-active-${i}"></div><span class="opp-label">Player ${i+2}</span>`;
    oz.appendChild(slot);
  }
  $('player-name-label').textContent=S.user?S.user.username:'You';
  updatePlayerBack();
}

// ── Round ────────────────────────────────────────────────
function startRound() {
  S.roundNum++; updateScoreBar();
  $('cards-in-play').innerHTML=''; $('player-card-area').innerHTML='';
  clearContinueTimer();
  if(getActivePlayers().length===1){endGame();return;}
  while(!playerHasCards(S.callerIndex)) S.callerIndex=(S.callerIndex+1)%(S.numOpponents+1);
  if(S.callerIndex===0) humanCallPhase(); else computerCallPhase();
}

// ── Human turn ───────────────────────────────────────────
function humanCallPhase() {
  const card=S.playerHand[0];
  msg('Your turn! Pick the trait you want to play. (As caller, your XTRA does not apply this round.)');
  const cardEl=document.createElement('div'); cardEl.className='player-card flip-in';
  cardEl.innerHTML=`<img src="${card.image}" alt="${card.id}" onerror="this.style.background='#222'" />
    <div class="trait-list">
      ${card.traits.map((t,i)=>`<button class="trait-btn" data-idx="${i}"><span class="t-name">${t.name}</span><span class="t-val">${t.value}</span></button>`).join('')}
      <div class="trait-btn xtra-row"><span class="t-name">XTRA: ${card.xtra.name}</span><span class="t-val">${card.xtra.value}</span></div>
    </div>`;
  cardEl.querySelectorAll('.trait-btn[data-idx]').forEach(btn=>{
    btn.addEventListener('click',()=>{S.calledTraitIdx=parseInt(btn.dataset.idx);resolveRound();});
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
  renderOppFaceUp(oppIdx,card,true); renderPlayerFaceUp(false);
  for(let i=0;i<S.numOpponents;i++){if(i!==oppIdx&&S.oppHands[i].length>0)renderOppFaceUp(i,S.oppHands[i][0],false);}
  showContinue(()=>resolveRound());
}

// ── Render cards face-up ──────────────────────────────────
function renderPlayerFaceUp(isCaller) {
  if(!S.playerHand.length)return;
  const card=S.playerHand[0];
  const el=document.createElement('div'); el.className='player-card flip-in';
  el.innerHTML=`<img src="${card.image}" alt="${card.id}" onerror="this.style.background='#222'" />
    <div class="trait-list">
      ${card.traits.map((t,i)=>`<div class="trait-btn${i===S.calledTraitIdx?' highlighted':''}" style="pointer-events:none"><span class="t-name">${t.name}</span><span class="t-val">${t.value}</span></div>`).join('')}
      ${!isCaller&&card.xtra.value>0?`<div class="trait-btn xtra-add" style="pointer-events:none"><span class="t-name">+XTRA: ${card.xtra.name}</span><span class="t-val">+${card.xtra.value}</span></div>`:''}
    </div>`;
  $('player-card-area').innerHTML=''; $('player-card-area').appendChild(el);
}

function renderOppFaceUp(oppIdx,card,isCaller) {
  const el=$(`opp-active-${oppIdx}`); if(!el)return;
  el.innerHTML=`<div class="opp-face-card flip-in">
    <div class="opp-name">Player ${oppIdx+2}</div>
    <img src="${card.image}" alt="${card.id}" onerror="this.style.background='#333'" />
    ${card.traits.map((t,i)=>`<div class="opp-trait-row${i===S.calledTraitIdx?' called':''}">${t.name}<span>${t.value}</span></div>`).join('')}
    ${!isCaller&&card.xtra.value>0?`<div class="opp-trait-row xtra">+XTRA: ${card.xtra.name}<span>+${card.xtra.value}</span></div>`:''}
  </div>`;
}

// ── Resolve round ────────────────────────────────────────
function resolveRound() {
  hideContinue(); clearContinueTimer();
  const traitIdx=S.calledTraitIdx; const scores=[];
  if(S.playerHand.length>0){const card=S.playerHand[0];const base=card.traits[traitIdx].value;const xtra=S.callerIndex!==0?card.xtra.value:0;scores.push({playerIdx:0,card,score:base+xtra});}
  for(let i=0;i<S.numOpponents;i++){if(!S.oppHands[i].length)continue;const card=S.oppHands[i][0];const base=card.traits[traitIdx].value;const xtra=S.callerIndex!==i+1?card.xtra.value:0;scores.push({playerIdx:i+1,card,score:base+xtra});}
  const maxScore=Math.max(...scores.map(s=>s.score));
  const winners=scores.filter(s=>s.score===maxScore); const isTie=winners.length>1;
  const roundCards=scores.map(s=>s.card);
  if(isTie){
    S.frozenPile.push(...roundCards);
    if(S.playerHand.length>0)S.playerHand.shift();
    for(let i=0;i<S.numOpponents;i++){if(S.oppHands[i].length>0)S.oppHands[i].shift();}
    const stillAlive=winners.filter(w=>playerHasCards(w.playerIdx));
    if(stillAlive.length===1){giveCardsToWinner(stillAlive[0].playerIdx,S.frozenPile);S.frozenPile=[];}
    msg(`Tie! ${S.frozenPile.length} card(s) frozen. Same caller goes again with their next card…`);
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
    // Highlight winner card then play animation
    highlightWinnerCard(wi);
    setTimeout(()=>{
      playWinAnimation(winner.card,()=>{
        if(getActivePlayers().length===1){endGame();return;}
        // Show player their next card face-up, then Continue
        if(S.playerHand.length>0)renderPlayerFaceUp(S.callerIndex!==0);
        showContinue(()=>startRound());
      });
    }, 600);
  }
}

function highlightWinnerCard(wi) {
  if(wi===0){const c=$('player-card-area').querySelector('.player-card');if(c)c.classList.add('card-winner');}
  else{const c=$(`opp-active-${wi-1}`).querySelector('.opp-face-card');if(c)c.classList.add('card-winner');}
  // Star ping
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
  // Submit score to DB (non-blocking)
  if(S.wallet&&humanWon){
    fetch('/api/scores/amx',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({walletAddress:S.wallet,score:points,opponents:S.numOpponents})}).catch(()=>{});
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
    const rows=await fetch('/api/leaderboard/amx').then(r=>r.json());
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
