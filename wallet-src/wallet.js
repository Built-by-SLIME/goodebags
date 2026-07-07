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

function dispatch(eventName) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(eventName));
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

  try {
    console.log('[Wallet] Creating WalletConnectModal...');
    modal = new WalletConnectModal({
      projectId,
      chains: CHAINS,
      enableExplorer: true
    });
    console.log('[Wallet] WalletConnectModal created');
  } catch (e) {
    console.error('[Wallet] WalletConnectModal creation failed:', e);
    alert('Wallet modal init failed: ' + e.message);
    throw e;
  }

  return { provider, modal };
}

export async function openConnect(projectId) {
  console.log('[Wallet] openConnect() called');
  let modalShown = false;
  let pollInterval = null;

  try {
    const { provider, modal } = await init(projectId);
    console.log('[Wallet] Provider+Modal ready');

    console.log('[Wallet] Starting provider.connect() — this will wait for user approval...');

    const connectPromise = provider.connect({
      namespaces: {
        hedera: {
          chains: ['hedera:mainnet', 'hedera:testnet'],
          methods: [],
          events: []
        },
        xrpl: {
          chains: ['xrpl:0', 'xrpl:1'],
          methods: [],
          events: []
        }
      }
    });

    const showModal = (uri) => {
      if (modalShown || !uri) return;
      modalShown = true;
      console.log('[Wallet] Opening WalletConnect modal with URI');
      modal.openModal({ uri });
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
    };
    setTimeout(stopPolling, 5000);

    // Now await the actual user approval
    const session = await connectPromise;
    stopPolling();
    console.log('[Wallet] User approved session');
    if (modal) modal.closeModal();

    const addr = getAddress();
    const chain = getChain();
    if (addr) setWalletCache(addr, chain);

    dispatch('walletConnected');
    return session;
  } catch (e) {
    if (pollInterval) clearInterval(pollInterval);
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
  for (const nsKey of Object.keys(session.namespaces)) {
    if (nsKey.includes('hedera')) return 'hedera';
    if (nsKey.includes('xrpl')) return 'xrpl';
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
