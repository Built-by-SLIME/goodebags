/* ── Shared: Wallet Selector Modal ─────────────────────────────────────────
   Two connection paths: WalletConnect (Hedera + XRPL) and Xaman (XRPL only).
   Returns a promise resolving to { type, address, chain }.
   ─────────────────────────────────────────────────────────────────────────── */

let _xummInstance = null;
let _xamanApiKey = null;
let _selectorPromise = null;

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
        await WalletModule.openConnect(projectId);
        const info = await getWalletInfoFromWC();
        if (info && info.address) {
          _selectorPromise = null;
          resolve({ type: 'wc', address: info.address, chain: info.chain });
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
      if (!_xamanApiKey) {
        _selectorPromise = null;
        reject(new Error('Xaman API key not configured'));
        return;
      }
      if (!_xummInstance) {
        _xummInstance = new Xumm(_xamanApiKey);
      }
      modal.style.display = '';
      _xummInstance.authorize();

      const onSuccess = async () => {
        try {
          const account = await _xummInstance.user.account;
          _xummInstance.off('success', onSuccess);
          _xummInstance.off('error', onError);
          _selectorPromise = null;
          resolve({ type: 'xaman', address: account, chain: 'xrpl' });
        } catch (e) {
          onError(e);
        }
      };
      const onError = () => {
        _xummInstance.off('success', onSuccess);
        _xummInstance.off('error', onError);
        _selectorPromise = null;
        reject(new Error('Xaman connection failed'));
      };

      _xummInstance.on('success', onSuccess);
      _xummInstance.on('error', onError);
    };
  });
}

/* ── Extended wallet-utils: read address + chain from WC IndexedDB ───────── */
function getWalletInfoFromWC() {
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
