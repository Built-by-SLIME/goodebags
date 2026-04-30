import { WalletConnectModal } from '@walletconnect/modal';
import { UniversalProvider } from '@walletconnect/universal-provider';

let provider = null;
let modal = null;
let currentProjectId = null;

const CHAINS = ['hedera:mainnet', 'hedera:testnet', 'xrpl:0', 'xrpl:1'];

async function init(projectId) {
  if (provider && currentProjectId === projectId) return { provider, modal };
  currentProjectId = projectId;

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

  return { provider, modal };
}

export async function openConnect(projectId) {
  const { provider, modal } = await init(projectId);

  const { uri, approval } = await provider.connect({
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

  if (uri) {
    modal.openModal({ uri });
  }

  const session = await approval();
  return session;
}

export async function disconnectWallet() {
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
