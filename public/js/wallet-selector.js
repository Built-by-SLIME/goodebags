/* ── Shared: Wallet Selector Modal ─────────────────────────────────────────
   Two connection paths: WalletConnect (Hedera + XRPL) and Xaman (XRPL only).
   Returns a promise resolving to { type, address, chain }.
   ─────────────────────────────────────────────────────────────────────────── */

let _xamanApiKey = null;
let _selectorPromise = null;
let _xamanAccount = null; // Global cache updated by _initXamanGlobalListener

/* ── Build modal on first use ────────────────────────────────────────────── */
function _buildModal() {
  if (document.getElementById('wallet-selector-modal')) return;

  const el = document.createElement('div');
  el.id = 'wallet-selector-modal';
  el.className = 'ws-modal';
  el.innerHTML = `
    <div class="ws-backdrop"></div>
    <div class="ws-card">
      <button class="ws-close" aria-label="Close">&times;</button>
      <h2 class="ws-title">Connect Wallet</h2>

      <div class="ws-options">
        <button class="ws-option" id="ws-wc">
          <div class="ws-option-icon">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 9.5L12 3L21 9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M3 14.5L12 21L21 14.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="ws-option-body">
            <div class="ws-option-name">WalletConnect</div>
            <div class="ws-option-desc">HashPack, Kabila, Joey, Ledger & more</div>
            <div class="ws-badges">
              <span class="ws-badge">HashPack</span>
              <span class="ws-badge">Kabila</span>
              <span class="ws-badge">Joey</span>
            </div>
          </div>
          <div class="ws-option-arrow">&rsaquo;</div>
        </button>

        <button class="ws-option" id="ws-xaman">
          <div class="ws-option-icon" style="background:#1a1a2e;">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#3051FC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="#3051FC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="#3051FC" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="ws-option-body">
            <div class="ws-option-name">Xaman</div>
            <div class="ws-option-desc">XRPL native wallet</div>
          </div>
          <div class="ws-option-arrow">&rsaquo;</div>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(el);

  el.querySelector('.ws-backdrop').addEventListener('click', _onClose);
  el.querySelector('.ws-close').addEventListener('click', _onClose);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') _onClose(); });
}

function _onClose() {
  const modal = document.getElementById('wallet-selector-modal');
  if (modal) modal.style.display = '';
  if (_selectorPromise) {
    _selectorPromise.reject(new Error('User cancelled'));
    _selectorPromise = null;
  }
}

/* ── Public API ──────────────────────────────────────────────────────────── */
function initWalletSelector(apiKey) {
  _xamanApiKey = apiKey;
  _initXamanGlobalListener(apiKey);
}

/* ── Global Xaman listener (runs on every page load to catch redirect results) ── */
function _initXamanGlobalListener(apiKey) {
  if (!apiKey || typeof Xumm === 'undefined') return;

  const xumm = new Xumm(apiKey);

  // Proactive check: try to read account directly without waiting for events.
  // On redirect tabs the SDK may have the session but may not fire ready/success.
  setTimeout(async () => {
    try {
      const account = await xumm.user.account;
      if (account) {
        _xamanAccount = account;
        localStorage.setItem('gb_xamanAccount', account);
        console.log('[Xaman Global] Proactive account found:', account);
      }
    } catch (e) {}
  }, 2000);

  xumm.on('ready', async () => {
    try {
      const account = await xumm.user.account;
      if (account) {
        _xamanAccount = account;
        localStorage.setItem('gb_xamanAccount', account);
        console.log('[Xaman Global] Ready with account:', account);
      }
    } catch (e) {}
  });

  xumm.on('success', async () => {
    try {
      const account = await xumm.user.account;
      if (account) {
        _xamanAccount = account;
        localStorage.setItem('gb_xamanAccount', account);
        console.log('[Xaman Global] Success with account:', account);
      }
    } catch (e) {}
  });

  xumm.on('logout', () => {
    _xamanAccount = null;
    localStorage.removeItem('gb_xamanAccount');
    console.log('[Xaman Global] Logout');
  });

  xumm.on('error', (err) => {
    console.error('[Xaman Global] Error:', err);
  });
}

function showWalletSelector(projectId) {
  return new Promise((resolve, reject) => {
    _selectorPromise = { resolve, reject };
    _buildModal();
    const modal = document.getElementById('wallet-selector-modal');
    modal.style.display = 'flex';

    const wcBtn = document.getElementById('ws-wc');
    const xamanBtn = document.getElementById('ws-xaman');

    // WalletConnect handler
    wcBtn.onclick = async () => {
      modal.style.display = '';
      try {
        if (typeof WalletModule === 'undefined') throw new Error('Wallet module not loaded');
        // openConnect can hang on mobile when the browser is backgrounded.
        // Race it with a 45-second timeout and then check getAddress() directly.
        let session;
        try {
          session = await Promise.race([
            WalletModule.openConnect(projectId),
            new Promise((_, reject) => setTimeout(() => reject(new Error('WalletConnect timeout')), 45000))
          ]);
        } catch (err) {
          if (err.message !== 'WalletConnect timeout') throw err;
          // Timeout: the wallet may still have connected while the browser was backgrounded.
          // Poll getAddress() for up to 5 seconds to see if the session arrived.
          let polledAddress = null;
          for (let i = 0; i < 50; i++) {
            if (typeof WalletModule.getAddress === 'function') {
              polledAddress = WalletModule.getAddress();
              if (polledAddress) break;
            }
            await new Promise(r => setTimeout(r, 100));
          }
          if (polledAddress) {
            session = { __polled: true, address: polledAddress };
          } else {
            throw new Error('WalletConnect timed out. Please close the wallet app and try again.');
          }
        }
        let address = null;
        let chain = 'unknown';
        if (session && session.__polled) {
          address = session.address;
        } else if (session && session.namespaces) {
          for (const [nsKey, ns] of Object.entries(session.namespaces)) {
            if (ns.accounts && ns.accounts.length > 0) {
              const parts = ns.accounts[0].split(':');
              address = parts[parts.length - 1] || null;
              chain = nsKey.includes('hedera') ? 'hedera' : nsKey.includes('xrpl') ? 'xrpl' : 'unknown';
              break;
            }
          }
        }
        // Fallback: read from WalletModule in-memory provider
        if (!address && typeof WalletModule.getAddress === 'function') {
          address = WalletModule.getAddress();
          if (address) {
            const s = typeof WalletModule.getSession === 'function' ? WalletModule.getSession() : null;
            if (s && s.namespaces) {
              for (const nsKey of Object.keys(s.namespaces)) {
                if (nsKey.includes('hedera')) { chain = 'hedera'; break; }
                if (nsKey.includes('xrpl')) { chain = 'xrpl'; break; }
              }
            }
          }
        }
        if (address) {
          _selectorPromise = null;
          resolve({ type: 'wc', address, chain });
        } else {
          throw new Error('WalletConnect failed');
        }
      } catch (e) {
        _selectorPromise = null;
        reject(e);
      }
    };

    // Xaman handler
    xamanBtn.onclick = () => {
      console.log('[Xaman] Button clicked');

      if (!_xamanApiKey) {
        console.error('[Xaman] API key missing');
        alert('Xaman is not configured. Please check /api/config.');
        _selectorPromise = null;
        reject(new Error('Xaman API key not configured'));
        return;
      }

      if (typeof Xumm === 'undefined') {
        console.error('[Xaman] Xumm SDK not loaded');
        alert('Xaman SDK failed to load. Check your internet connection and try again.');
        _selectorPromise = null;
        reject(new Error('Xumm SDK not loaded'));
        return;
      }

      // Fast path: use already-cached account from this session or localStorage
      if (_xamanAccount) {
        console.log('[Xaman] Using cached account:', _xamanAccount);
        _selectorPromise = null;
        resolve({ type: 'xaman', address: _xamanAccount, chain: 'xrpl' });
        return;
      }
      const stored = localStorage.getItem('gb_xamanAccount');
      if (stored) {
        console.log('[Xaman] Using stored account from localStorage:', stored);
        _selectorPromise = null;
        resolve({ type: 'xaman', address: stored, chain: 'xrpl' });
        return;
      }

      modal.style.display = '';

      let xumm;
      try {
        xumm = new Xumm(_xamanApiKey);
        console.log('[Xaman] Instance created, calling authorize()');
        xumm.authorize();
      } catch (e) {
        console.error('[Xaman] Error creating instance or calling authorize:', e);
        alert('Xaman failed to start: ' + (e.message || 'Unknown error'));
        _selectorPromise = null;
        reject(e);
        return;
      }

      let resolved = false;
      const cleanup = () => {
        clearTimeout(timeout);
        clearInterval(pollInterval);
      };

      // 30-second timeout: if nothing happens, kill the flow and alert the user
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          console.error('[Xaman] Connection timeout');
          alert('Xaman connection timed out. Please close the Xaman app and try again.');
          _selectorPromise = null;
          reject(new Error('Xaman connection timeout'));
        }
      }, 30000);

      // Poll localStorage every 500ms — on mobile the redirect opens a new tab,
      // the new tab's global listener writes the account, and this tab picks it up.
      const pollInterval = setInterval(() => {
        if (resolved) return;
        const account = localStorage.getItem('gb_xamanAccount');
        if (account) {
          resolved = true;
          cleanup();
          console.log('[Xaman] Account found via localStorage polling:', account);
          _selectorPromise = null;
          resolve({ type: 'xaman', address: account, chain: 'xrpl' });
        }
      }, 500);

      const onError = (err) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        console.error('[Xaman] Error event:', err);
        _selectorPromise = null;
        reject(new Error('Xaman connection failed'));
      };

      const onSuccess = async () => {
        if (resolved) return;
        resolved = true;
        cleanup();
        try {
          const account = await xumm.user.account;
          console.log('[Xaman] Success, account:', account);
          if (account) {
            _xamanAccount = account;
            localStorage.setItem('gb_xamanAccount', account);
          }
          _selectorPromise = null;
          resolve({ type: 'xaman', address: account, chain: 'xrpl' });
        } catch (e) {
          onError(e);
        }
      };

      xumm.on('success', onSuccess);
      xumm.on('error', onError);
    };
  });
}

/* ── Xaman session helpers ─────────────────────────────────────────────────── */
async function getXamanAccount(apiKey) {
  if (!apiKey || typeof Xumm === 'undefined') return null;

  // Fast path: use global cache or localStorage
  if (_xamanAccount) return _xamanAccount;
  const stored = localStorage.getItem('gb_xamanAccount');
  if (stored) return stored;

  // Slow path: wait for SDK to initialize and restore stored session
  return new Promise((resolve) => {
    let resolved = false;
    const xumm = new Xumm(apiKey);

    const cleanup = () => {
      try { xumm.off('ready', onReady); } catch (e) {}
      try { xumm.off('success', onSuccess); } catch (e) {}
      try { xumm.off('logout', onLogout); } catch (e) {}
    };

    const onReady = async () => {
      if (resolved) return;
      try {
        const account = await xumm.user.account;
        if (account && !resolved) {
          resolved = true;
          cleanup();
          _xamanAccount = account;
          localStorage.setItem('gb_xamanAccount', account);
          resolve(account);
          return;
        }
      } catch (e) {}
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(null);
      }
    };

    const onSuccess = async () => {
      if (resolved) return;
      try {
        const account = await xumm.user.account;
        if (account && !resolved) {
          resolved = true;
          cleanup();
          _xamanAccount = account;
          localStorage.setItem('gb_xamanAccount', account);
          resolve(account);
          return;
        }
      } catch (e) {}
    };

    const onLogout = () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      clearXamanAccount();
      resolve(null);
    };

    xumm.on('ready', onReady);
    xumm.on('success', onSuccess);
    xumm.on('logout', onLogout);

    // Proactive check: try to read account directly without waiting for events.
    // On redirect tabs the SDK may have the session but may not fire ready/success.
    setTimeout(async () => {
      if (resolved) return;
      try {
        const account = await xumm.user.account;
        if (account && !resolved) {
          resolved = true;
          cleanup();
          _xamanAccount = account;
          localStorage.setItem('gb_xamanAccount', account);
          resolve(account);
        }
      } catch (e) {}
    }, 1500);

    // Hard timeout: if ready/success/logout never fire, resolve null
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(null);
      }
    }, 10000);
  });
}

function clearXamanAccount() {
  _xamanAccount = null;
  localStorage.removeItem('gb_xamanAccount');
}

function xummLogout() {
  clearXamanAccount();
  if (typeof Xumm === 'undefined' || !_xamanApiKey) return;
  try {
    const xumm = new Xumm(_xamanApiKey);
    if (typeof xumm.logout === 'function') {
      xumm.logout();
    }
  } catch (e) {
    console.error('[Xaman] Logout failed:', e);
  }
}

/* ── Extended wallet-utils: read address + chain from WalletConnect ─────────── */
function getWalletInfoFromWC() {
  return new Promise(resolve => {
    // Fast path: use WalletModule in-memory provider (reliable, no DB race)
    if (typeof WalletModule !== 'undefined' && typeof WalletModule.getAddress === 'function') {
      const address = WalletModule.getAddress();
      if (address) {
        let chain = 'unknown';
        const session = typeof WalletModule.getSession === 'function' ? WalletModule.getSession() : null;
        if (session && session.namespaces) {
          for (const nsKey of Object.keys(session.namespaces)) {
            if (nsKey.includes('hedera')) { chain = 'hedera'; break; }
            if (nsKey.includes('xrpl')) { chain = 'xrpl'; break; }
          }
        }
        resolve({ address, chain });
        return;
      }
    }
    // Slow path: read from IndexedDB (fragile, may race with DB write)
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
                for (const [nsKey, ns] of Object.entries(session.namespaces)) {
                  if (ns.accounts?.length) {
                    const parts = ns.accounts[0].split(':');
                    const address = parts[parts.length - 1] || null;
                    const chain = nsKey.includes('hedera') ? 'hedera' : nsKey.includes('xrpl') ? 'xrpl' : 'unknown';
                    resolve({ address, chain });
                    return;
                  }
                }
              }
              resolve(null);
            } catch (e) { resolve(null); }
          };
        };
      };
    } catch (e) { resolve(null); }
  });
}
