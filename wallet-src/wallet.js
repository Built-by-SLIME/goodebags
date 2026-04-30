import { WalletConnectModal } from '@walletconnect/modal';
import { UniversalProvider } from '@walletconnect/universal-provider';

let provider = null;
let modal = null;
let currentProjectId = null;

const CHAINS = ['hedera:mainnet', 'hedera:testnet', 'xrpl:0', 'xrpl:1'];

async function init(projectId) {
  console.log('[Wallet] init() called with projectId:', projectId ? 'set' : 'missing');
  if (provider && currentProjectId === projectId) {
    console.log('[Wallet] Reusing existing provider');
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
      enableExplorer: true,
      mobileWallets: [
        { id: 'hashpack', name: 'HashPack', links: { native: 'hashpack://', universal: 'https://hashpack.app' } },
        { id: 'kabila', name: 'Kabila', links: { native: 'kabila://', universal: 'https://kabila.app' } },
        { id: 'xaman', name: 'Xaman', links: { native: 'xaman://', universal: 'https://xaman.app' } },
        { id: 'joey', name: 'Joey', links: { native: 'joey://', universal: 'https://joeywallet.com' } }
      ]
    });
    console.log('[Wallet] WalletConnectModal created');
  } catch (e) {
    console.error('[Wallet] WalletConnectModal creation failed:', e);
    alert('Wallet modal init failed: ' + e.message);
    throw e;
  }

  return { provider, modal };
}

function testWebSocket(url) {
  return new Promise((resolve) => {
    console.log('[Wallet] Testing WebSocket to', url);
    try {
      const ws = new WebSocket(url);
      const timeout = setTimeout(() => {
        console.log('[Wallet] WebSocket test timed out');
        resolve(false);
        try { ws.close(); } catch(e) {}
      }, 5000);
      ws.onopen = () => {
        clearTimeout(timeout);
        console.log('[Wallet] WebSocket test: connected!');
        resolve(true);
        ws.close();
      };
      ws.onerror = (e) => {
        clearTimeout(timeout);
        console.log('[Wallet] WebSocket test: error', e);
        resolve(false);
      };
    } catch (e) {
      console.log('[Wallet] WebSocket test: exception', e);
      resolve(false);
    }
  });
}

export async function openConnect(projectId) {
  console.log('[Wallet] openConnect() called');
  try {
    const { provider, modal } = await init(projectId);
    console.log('[Wallet] Provider+Modal ready');

    // Test WebSocket connectivity first
    const wsOk = await testWebSocket('wss://relay.walletconnect.com');
    console.log('[Wallet] WebSocket connectivity:', wsOk);

    console.log('[Wallet] About to call provider.connect()...');

    // Try provider.connect() with explicit timeout
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

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('provider.connect() timed out after 8s')), 8000);
    });

    let result;
    try {
      result = await Promise.race([connectPromise, timeoutPromise]);
    } catch (timeoutErr) {
      console.error('[Wallet] Timeout or error:', timeoutErr.message);
      // Even if it timed out, the connect might have emitted display_uri
      // Check if provider.uri was set
      if (provider.uri) {
        console.log('[Wallet] Found provider.uri after timeout:', provider.uri.substring(0, 30) + '...');
        modal.openModal({ uri: provider.uri });
        return null;
      }
      throw timeoutErr;
    }

    console.log('[Wallet] connect() resolved. Result:', result);
    console.log('[Wallet] Result type:', typeof result);
    if (result && typeof result === 'object') {
      console.log('[Wallet] Result keys:', Object.keys(result));
    }

    // provider.connect() returns the session directly, not {uri, approval}
    // The URI is emitted via 'display_uri' event and stored in provider.uri
    const uri = provider.uri;
    console.log('[Wallet] provider.uri present?', !!uri);

    if (uri) {
      console.log('[Wallet] Opening modal with URI...');
      modal.openModal({ uri });
      console.log('[Wallet] modal.openModal() called');
    } else {
      console.warn('[Wallet] No URI available');
    }

    return result;
  } catch (e) {
    console.error('[Wallet] openConnect error:', e);
    alert('Wallet connect error: ' + (e?.message || String(e)));
    throw e;
  }
}

export async function disconnectWallet() {
  console.log('[Wallet] disconnectWallet() called');
  if (provider) {
    await provider.disconnect();
  }
}

export function isConnected() {
  return !!(provider && provider.session);
}

export function getSession() {
  if (!provider) return null;
  return provider.session || null;
}
