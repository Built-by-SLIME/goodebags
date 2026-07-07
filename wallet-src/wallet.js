import { WalletConnectModal } from '@walletconnect/modal';
import { UniversalProvider } from '@walletconnect/universal-provider';

let provider = null;
let modal = null;
let currentProjectId = null;

const CHAINS = ['hedera:mainnet', 'hedera:testnet', 'xrpl:0', 'xrpl:1'];

// Keep references to registered event handlers so we can remove them before re-adding.
const listeners = {
  session_connect: null,
  session_delete: null,
  session_expire: null,
  display_uri: null
};

function dispatch(eventName, detail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  }
}

function clearWalletCache() {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem('gb_wcAddress');
    localStorage.removeItem('gb_wcChain');
  }
}

function setWalletCache(address, chain) {
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem('gb_wcAddress', address);
    localStorage.setItem('gb_wcChain', chain || 'unknown');
  }
}

function isHederaNamespace(nsKey, accounts) {
  if (nsKey.includes('hedera')) return true;
  if (nsKey.includes('eip155')) {
    // Hedera EVM-compatible chain IDs
    const hederaEvmChainIds = ['295', '296', '297'];
    if (accounts && accounts.length > 0) {
      const parts = accounts[0].split(':');
      if (parts.length >= 2 && hederaEvmChainIds.includes(parts[1])) return true;
    }
  }
  return false;
}

function isXrplNamespace(nsKey) {
  return nsKey.includes('xrpl');
}

export async function init(projectId) {
  console.log('[Wallet] init() called with projectId:', projectId ? 'set' : 'missing');
  if (provider && currentProjectId === projectId) {
    console.log('[Wallet] Reusing existing provider');
    // If the provider exists but has no session, make sure stale localStorage is cleared.
    if (!provider.session) clearWalletCache();
    return { provider, modal };
  }
  currentProjectId = projectId;

  try {
    console.log('[Wallet] Initializing UniversalProvider...');
    provider = await UniversalProvider.init({
      projectId,
      relayUrl: 'wss://relay.walletconnect.com',
      metadata: {
        name: 'Goodebags Games',
        description: 'Collect. Play. Compete.',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://goodebags.games',
        icons: ['https://goodebags.games/assets/goodebags-logo.png']
      }
    });
    console.log('[Wallet] UniversalProvider initialized');

    // Remove old listeners before adding new ones to prevent duplicates across re-inits.
    if (listeners.session_connect) provider.events.off('session_connect', listeners.session_connect);
    if (listeners.session_delete) provider.events.off('session_delete', listeners.session_delete);
    if (listeners.session_expire) provider.events.off('session_expire', listeners.session_expire);

    listeners.session_connect = () => {
      console.log('[Wallet] session_connect event');
      const addr = getAddress();
      const chain = getChain();
      if (addr) setWalletCache(addr, chain);
      dispatch('walletConnected');
    };
    listeners.session_delete = () => {
      console.log('[Wallet] session_delete event');
      clearWalletCache();
      dispatch('walletDisconnected');
    };
    listeners.session_expire = () => {
      console.log('[Wallet] session_expire event');
      clearWalletCache();
      dispatch('walletDisconnected');
    };

    provider.events.on('session_connect', listeners.session_connect);
    provider.events.on('session_delete', listeners.session_delete);
    provider.events.on('session_expire', listeners.session_expire);

    // If there is a restored session, cache it. If not, clear any stale cache.
    if (provider.session) {
      const addr = getAddress();
      const chain = getChain();
      if (addr) setWalletCache(addr, chain);
    } else {
      clearWalletCache();
    }
  } catch (e) {
    console.error('[Wallet] UniversalProvider.init failed:', e);
    alert('Wallet provider init failed: ' + e.message);
    throw e;
  }

  return { provider, modal: null };
}

function createFallbackModal(uri) {
  if (!uri || typeof document === 'undefined') return;

  // Remove any existing fallback modal
  const existing = document.getElementById('wc-fallback-modal');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'wc-fallback-modal';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 2147483647;
    display: flex; align-items: center; justify-content: center;
    background: rgba(0,0,0,0.92); font-family: Inter, system-ui, sans-serif;
  `;

  overlay.innerHTML = `
    <div style="
      background: #111; border: 1px solid rgba(255,255,255,0.12);
      border-radius: 20px; padding: 28px; max-width: 420px; width: 90%;
      color: #fff; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.6);
    ">
      <h2 style="margin: 0 0 10px; font-size: 1.35rem; font-weight: 700;">Connect Wallet</h2>
      <p style="margin: 0 0 18px; color: #aaa; font-size: 0.9rem; line-height: 1.45;">
        The wallet list couldn't open automatically.<br>
        Copy the connection code below and paste it into your wallet app.
      </p>
      <div style="
        background: #000; border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px; padding: 12px; word-break: break-all;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.78rem; color: #ddd; margin-bottom: 16px;
        max-height: 120px; overflow-y: auto; text-align: left;
      " id="wc-fallback-uri">${uri}</div>
      <div style="display: flex; gap: 10px; justify-content: center;">
        <button id="wc-fallback-copy" style="
          background: #FFD700; color: #000; border: none; border-radius: 10px;
          padding: 10px 18px; font-weight: 700; cursor: pointer; font-size: 0.9rem;
        ">Copy Code</button>
        <button id="wc-fallback-close" style="
          background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.25);
          border-radius: 10px; padding: 10px 18px; font-weight: 600; cursor: pointer; font-size: 0.9rem;
        ">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#wc-fallback-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(uri);
      const btn = overlay.querySelector('#wc-fallback-copy');
      btn.textContent = 'Copied!';
      setTimeout(() => btn.textContent = 'Copy Code', 1500);
    } catch (e) {
      console.error('[Wallet] Fallback copy failed:', e);
    }
  });

  overlay.querySelector('#wc-fallback-close').addEventListener('click', () => {
    overlay.remove();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

export async function openConnect(projectId) {
  console.log('[Wallet] openConnect() called');
  let modalShown = false;
  let pollInterval = null;
  let fallbackTimer = null;

  try {
    const { provider } = await init(projectId);
    console.log('[Wallet] Provider ready');

    // Create a fresh modal instance for each connect attempt. Reusing the modal
    // across attempts was causing the desktop QR view to fail silently.
    console.log('[Wallet] Creating WalletConnectModal...');
    modal = new WalletConnectModal({
      projectId,
      chains: CHAINS,
      enableExplorer: true
    });
    console.log('[Wallet] WalletConnectModal created');

    console.log('[Wallet] Starting provider.connect() — this will wait for user approval...');

    const connectPromise = provider.connect({
      // Use optional namespaces so wallets can approve only the chains they support.
      // HashPack and other Hedera wallets require at least the standard Hedera
      // methods to be listed; empty methods:[] caused the Pair button to do nothing.
      optionalNamespaces: {
        hedera: {
          chains: ['hedera:mainnet', 'hedera:testnet'],
          methods: [
            'hedera_signAndExecuteTransaction',
            'hedera_signTransaction',
            'hedera_executeTransaction',
            'hedera_signMessage',
            'hedera_getNodeAddresses'
          ],
          events: ['chainChanged', 'accountsChanged']
        },
        xrpl: {
          chains: ['xrpl:0', 'xrpl:1'],
          methods: [
            'xrpl_signTransaction',
            'xrpl_signMessage',
            'xrpl_submitTransaction'
          ],
          events: ['chainChanged', 'accountsChanged']
        }
      }
    });

    const showModal = (uri) => {
      if (modalShown || !uri) return;
      modalShown = true;
      console.log('[Wallet] Opening WalletConnect modal with URI');
      try {
        modal.openModal({ uri });
      } catch (err) {
        console.error('[Wallet] modal.openModal threw:', err);
        createFallbackModal(uri);
      }
      // If the official modal doesn't attach itself to the DOM within 1.5s,
      // show a fallback so the user can still connect.
      fallbackTimer = setTimeout(() => {
        const wcm = document.querySelector('wcm-modal');
        if (!wcm) {
          console.warn('[Wallet] wcm-modal not found in DOM after 1.5s; showing fallback');
          createFallbackModal(uri);
        }
      }, 1500);
    };

    // Event-based — fires immediately when URI is generated
    listeners.display_uri = (uri) => {
      console.log('[Wallet] display_uri event received');
      showModal(uri);
    };
    provider.events.on('display_uri', listeners.display_uri);

    // Fallback polling every 100ms in case event fires before listener attached
    pollInterval = setInterval(() => {
      if (provider.uri) {
        clearInterval(pollInterval);
        pollInterval = null;
        showModal(provider.uri);
      }
    }, 100);

    // Stop polling once connect resolves or after 5s max
    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      if (listeners.display_uri) {
        provider.events.off('display_uri', listeners.display_uri);
        listeners.display_uri = null;
      }
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
    };
    setTimeout(stopPolling, 5000);

    // Now await the actual user approval
    const session = await connectPromise;
    stopPolling();
    const fallback = document.getElementById('wc-fallback-modal');
    if (fallback) fallback.remove();
    console.log('[Wallet] User approved session');
    if (modal) modal.closeModal();

    const addr = getAddress();
    const chain = getChain();
    if (addr) setWalletCache(addr, chain);

    dispatch('walletConnected');
    return session;
  } catch (e) {
    if (pollInterval) clearInterval(pollInterval);
    if (fallbackTimer) clearTimeout(fallbackTimer);
    if (listeners.display_uri && provider) {
      try { provider.events.off('display_uri', listeners.display_uri); } catch (_) {}
      listeners.display_uri = null;
    }
    console.error('[Wallet] openConnect error:', e);
    alert('Wallet connect error: ' + (e?.message || String(e)));
    throw e;
  }
}

export async function disconnectWallet() {
  console.log('[Wallet] disconnectWallet() called');
  clearWalletCache();
  if (provider) {
    try {
      await provider.disconnect();
    } catch (e) {
      console.error('[Wallet] provider.disconnect error:', e);
    }
  }
}

export function isConnected() {
  return !!(provider && provider.session);
}

export function getSession() {
  if (!provider) return null;
  return provider.session || null;
}

function getChain() {
  const session = provider && provider.session;
  if (!session || !session.namespaces) return 'unknown';
  for (const [nsKey, ns] of Object.entries(session.namespaces)) {
    if (isHederaNamespace(nsKey, ns.accounts)) return 'hedera';
    if (isXrplNamespace(nsKey)) return 'xrpl';
  }
  return 'unknown';
}

// Returns the first connected wallet address (any namespace)
export function getAddress() {
  const session = provider && provider.session;
  if (!session || !session.namespaces) return null;
  for (const ns of Object.values(session.namespaces)) {
    if (ns.accounts && ns.accounts.length > 0) {
      // Format is "chain:networkId:address" — return the address part
      const parts = ns.accounts[0].split(':');
      return parts[parts.length - 1] || null;
    }
  }
  return null;
}
