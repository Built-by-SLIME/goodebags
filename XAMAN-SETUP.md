# Xaman (Xumm) Wallet Integration & Token Gating — Setup Guide

> **Status:** Awaiting Xaman API key from client. This document contains the full implementation plan so nothing is lost.

---

## 1. Goal

- **Ape-Mod-X (AMX):** Replace guest play with **Xaman wallet connection** + **XRPL NFT token gating** (Taxon `777`).
- **The Bee's Knees (TBK):** Keep existing **WalletConnect** flow unchanged (Hedera support).

---

## 2. Architecture Summary

| Component | Current | Planned |
|-----------|---------|---------|
| TBK wallet | WalletConnect v2 (Hedera) | **No change** |
| AMX wallet | WalletConnect v2 (fallback) OR guest | **Xaman primary** + WalletConnect fallback |
| AMX gate | None (guest allowed) | **XRPL NFT ownership check** (Taxon 777) |
| TBK gate | Hedera mirror node (`0.0.7295055`) | **No change** |

---

## 3. Xaman SDK — What You Need

### 3.1 API Key
Get a **Xaman API key** from: https://apps.xaman.dev  
→ Create an app → copy the **API Key (UUID)**.

### 3.2 Browser (Vanilla JS) Integration

Load the SDK via CDN in `public/games/apemodx/index.html`:

```html
<script src="https://xumm.app/assets/cdn/xumm.min.js"></script>
```

Instantiate and listen in `public/games/apemodx/game.js`:

```javascript
let xumm = null;

function initXaman(apiKey) {
  xumm = new Xumm(apiKey);

  xumm.on('ready', () => {
    console.log('[Xaman] SDK ready');
  });

  xumm.on('success', async () => {
    const account = await xumm.user.account;
    console.log('[Xaman] Signed in:', account);
    // account = "rN7n7..."  — pass to initAuth() or store in S.wallet
  });

  xumm.on('logout', () => {
    console.log('[Xaman] Signed out');
    S.wallet = null;
  });
}

// Call from a button click
function signInWithXaman() {
  if (!xumm) return;
  xumm.authorize(); // opens QR / deep-link
}
```

### 3.3 Backend Config Endpoint

Add `XAMAN_API_KEY` env var. In `server.js` `/api/config`:

```javascript
res.json({
  walletConnectProjectId: process.env.WALLETCONNECT_PROJECT_ID || '',
  xamanApiKey: process.env.XAMAN_API_KEY || '',
  r2BaseUrl: process.env.R2_BASE_URL || ''
});
```

---

## 4. AMX Auth Flow Changes

### 4.1 `initAuth()` — New Logic

```javascript
async function initAuth() {
  // Load config (R2 + wallet project ID + Xaman key)
  try {
    const cfg = await fetch('/api/config').then(r => r.json());
    R2 = (cfg.r2BaseUrl || '').replace(/\/$/, '') + '/apemodx';
    _walletProjectId = cfg.walletConnectProjectId || '';
    if (cfg.xamanApiKey) initXaman(cfg.xamanApiKey);
  } catch(e) {}

  // 1. Try Xaman first
  let wallet = null;
  if (xumm) {
    try { wallet = await xumm.user.account; } catch(e) {}
  }

  // 2. Fallback to WalletConnect (XRPL or Hedera users who prefer WC)
  if (!wallet) {
    wallet = await getWalletFromWC();
  }

  // 3. No wallet at all → show auth screen with both buttons
  if (!wallet) {
    show('auth');
    $('auth-status').textContent = 'Connect your wallet to play Ape-Mod-X.';
    $('btn-connect-wallet').style.display = '';
    $('btn-xaman-signin').style.display = ''; // new button
    return;
  }

  S.wallet = wallet;

  // 4. Token gate: check XRPL NFT ownership (Taxon 777)
  const hasToken = await checkXrplNftGate(wallet);
  if (!hasToken) {
    show('auth');
    $('auth-status').textContent = 'You need an Ape-Mod-X NFT to play.';
    // Optionally show "Get NFT" marketplace link
    return;
  }

  // 5. Look up / register user
  try {
    const res = await fetch(`/api/user/${S.wallet}`);
    if (res.ok) { S.user = await res.json(); goToLobby(); }
    else show('register');
  } catch(e) {
    S.user = { username: 'Guest', wallet_address: S.wallet };
    goToLobby();
  }
}
```

### 4.2 Remove Guest Play

Delete this block from current `initAuth()`:

```javascript
// REMOVE:
if (!S.wallet) {
  S.user = { username: 'Guest' };
  goToLobby();
  return;
}
```

---

## 5. XRPL Token Gate Implementation

### 5.1 Check Method: `account_nfts`

XRPL public node endpoint: `https://xrplcluster.com` (or `wss://xrplcluster.com`)

```javascript
async function checkXrplNftGate(address) {
  const AMX_TAXON = 777;
  const payload = {
    method: 'account_nfts',
    params: [{ account: address }]
  };

  try {
    const res = await fetch('https://xrplcluster.com/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    const nfts = data.result?.account_nfts || [];

    return nfts.some(nft => nft.NFTokenTaxon === AMX_TAXON);
  } catch (e) {
    console.error('[Gate] XRPL check failed:', e);
    return false; // fail closed
  }
}
```

### 5.2 Test NFT for Verification

Your specific test NFT:
- **NFTokenID:** `00081388E998DF54B5D8F5E3C81C5202AE2C3B8CC96538DC3C31C47904A2D8D5`
- **Taxon:** `777`

To verify the above logic works with your wallet, you can manually test:

```bash
curl -X POST https://xrplcluster.com/ \
  -H "Content-Type: application/json" \
  -d '{
    "method": "account_nfts",
    "params": [{ "account": "rYOURADDRESSHERE" }]
  }'
```

Look for `NFTokenTaxon: 777` in the response.

---

## 6. Game Selector Token Gate (Mirror TBK Pattern)

In `public/games/index.html`, add the AMX gate alongside the existing TBK gate:

```javascript
(async function() {
  const AMX_TAXON = 777;
  const amxCard = document.getElementById('amx-card');
  if (!amxCard) return;

  // Try Xaman first
  let addr = null;
  if (typeof xumm !== 'undefined') {
    try { addr = await xumm.user.account; } catch(e) {}
  }
  // Fallback to WalletConnect
  if (!addr) addr = await getWalletFromWC();

  if (!addr) {
    amxCard.classList.add('locked');
    amxCard.removeAttribute('href');
    amxCard.addEventListener('click', (e) => {
      e.preventDefault();
      alert('Connect an XRPL wallet (Xaman or WalletConnect) to play Ape-Mod-X.');
    });
    return;
  }

  // Check XRPL NFT ownership
  let hasToken = false;
  try {
    const res = await fetch('https://xrplcluster.com/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: 'account_nfts',
        params: [{ account: addr }]
      })
    });
    const data = await res.json();
    const nfts = data.result?.account_nfts || [];
    hasToken = nfts.some(n => n.NFTokenTaxon === AMX_TAXON);
  } catch (e) {}

  if (!hasToken) {
    amxCard.classList.add('locked');
    amxCard.removeAttribute('href');
    amxCard.addEventListener('click', (e) => {
      e.preventDefault();
      alert('You need an Ape-Mod-X NFT (Taxon 777) to play.');
    });
  }
})();
```

---

## 7. UI / HTML Changes Needed

### 7.1 AMX `index.html` — Add Xaman Button

In the auth screen (`#screen-auth`), add a second button:

```html
<button id="btn-xaman-signin" class="btn-primary btn-lg" style="display:none">
  Sign in with Xaman
</button>
<button id="btn-connect-wallet" class="btn-outline btn-lg" style="display:none">
  Connect Wallet (WalletConnect)
</button>
```

Wire `btn-xaman-signin` to `signInWithXaman()` in `game.js`.

### 7.2 Keep `wallet-utils.js` Unchanged

`getWalletFromWC()` should remain as the WalletConnect fallback for:
- Users who already have WalletConnect session active
- TBK (Hedera) players who navigate to AMX

---

## 8. Environment Variables (Railway / .env)

```
WALLETCONNECT_PROJECT_ID=your-wc-project-id
XAMAN_API_KEY=your-xaman-api-key-uuid
R2_BASE_URL=your-r2-url
DATABASE_URL=your-postgres-url
```

---

## 9. Testing Checklist

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open `/games/` with no wallet | AMX card locked, message shown |
| 2 | Open `/games/` with Xaman signed in + Taxon 777 NFT | AMX card unlocked, clickable |
| 3 | Open `/games/` with WalletConnect XRPL + Taxon 777 NFT | AMX card unlocked, clickable |
| 4 | Open `/games/apemodx/` directly, no wallet | Auth screen with both buttons |
| 5 | Click "Sign in with Xaman" | Xaman app opens (QR or deep link) |
| 6 | Sign in, return to game | `initAuth()` detects account, checks NFT, proceeds to lobby |
| 7 | Play a round, check leaderboard | Score submits with `S.wallet` set from Xaman address |
| 8 | Open TBK | WalletConnect flow still works, Hedera token gate still active |
| 9 | Test NFT without Taxon 777 | Gate blocks, "You need an Ape-Mod-X NFT" message |
| 10 | Test with specific NFT `00081388E998DF54B5D8F5E3C81C5202AE2C3B8CC96538DC3C31C47904A2D8D5` | Gate passes |

---

## 10. Files to Modify (Complete List)

| File | Change |
|------|--------|
| `server.js` | Add `xamanApiKey` to `/api/config` |
| `public/games/apemodx/index.html` | Add Xaman CDN script + new sign-in button |
| `public/games/apemodx/game.js` | `initAuth()` rewrite, `checkXrplNftGate()`, remove guest play |
| `public/games/index.html` | Add AMX XRPL NFT gate alongside TBK Hedera gate |
| `.env` / Railway vars | Add `XAMAN_API_KEY` |

---

## 11. Post-API-Key Action Items

Once the client provides the Xaman API key:

1. Add `XAMAN_API_KEY` to Railway environment variables.
2. Implement the code changes above (estimated 2–3 files, ~80 lines of JS).
3. Test with the known NFT (`00081388...A2D8D5`) to verify gate logic.
4. Push and deploy.
