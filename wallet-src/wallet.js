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
    const walletList = [
      { id: 'hashpack', name: 'HashPack', links: { native: 'hashpack://', universal: 'https://hashpack.app' } },
      { id: 'kabila', name: 'Kabila', links: { native: 'kabila://', universal: 'https://kabila.app' } },
      { id: 'xaman', name: 'Xaman', links: { native: 'xaman://', universal: 'https://xaman.app' } },
      { id: 'joey', name: 'Joey', links: { native: 'joey://', universal: 'https://joeywallet.com' } }
    ];

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const walletImages = {
      hashpack: `${origin}/images/wallets/hashpack.png`,
      kabila: `${origin}/images/wallets/kabila.png`,
      xaman: `${origin}/images/wallets/xaman.png`,
      joey: `${origin}/images/wallets/joey.png`
    };

    modal = new WalletConnectModal({
      projectId,
      chains: CHAINS,
      enableExplorer: true,
      mobileWallets: walletList,
      desktopWallets: walletList,
      walletImages
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
  try {
    const { provider, modal } = await init(projectId);
    console.log('[Wallet] Provider+Modal ready');

    console.log('[Wallet] Starting provider.connect() — this will wait for user approval...');

    // provider.connect() waits for the user to approve/reject in their wallet.
    // We must NOT block on it — show the modal the instant the URI is available.
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

    // Open modal as soon as URI is emitted (display_uri event) or stored on provider
    let modalShown = false;
    const showModal = (uri) => {
      if (modalShown || !uri) return;
      modalShown = true;
      console.log('[Wallet] Opening WalletConnect modal with URI');
      modal.openModal({ uri });
    };

    // Event-based — fires immediately when URI is generated
    provider.events.on('display_uri', (uri) => {
      console.log('[Wallet] display_uri event received');
      showModal(uri);
    });

    // Fallback polling every 100ms in case event fires before listener attached
    const pollInterval = setInterval(() => {
      if (provider.uri) {
        clearInterval(pollInterval);
        showModal(provider.uri);
      }
    }, 100);

    // Stop polling once connect resolves or after 5s max
    setTimeout(() => clearInterval(pollInterval), 5000);

    // Now await the actual user approval (this can take seconds/minutes)
    const session = await connectPromise;
    console.log('[Wallet] User approved session');
    return session;
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
