import { UniversalProvider } from '@walletconnect/universal-provider';

let provider = null;
let session = null;
let currentProjectId = null;

const WALLET_META = {
  hashpack: {
    name: 'HashPack',
    icon: 'https://hashpack.app/img/logo.svg',
    chains: ['hedera:mainnet', 'hedera:testnet'],
    deepLink: 'hashpack://wc?uri='
  },
  kabila: {
    name: 'Kabila',
    icon: '',
    chains: ['hedera:mainnet', 'hedera:testnet'],
    deepLink: 'kabila://wc?uri='
  },
  xaman: {
    name: 'Xaman',
    icon: '',
    chains: ['xrpl:0', 'xrpl:1'],
    deepLink: 'xaman://wc?uri='
  },
  joey: {
    name: 'Joey',
    icon: '',
    chains: ['xrpl:0', 'xrpl:1'],
    deepLink: 'joey://wc?uri='
  }
};

async function initProvider(projectId) {
  if (provider && currentProjectId === projectId) return provider;
  currentProjectId = projectId;
  provider = await UniversalProvider.init({
    projectId: projectId,
    relayUrl: 'wss://relay.walletconnect.com',
    metadata: {
      name: 'Goodebags Games',
      description: 'Collect. Play. Compete.',
      url: typeof window !== 'undefined' ? window.location.origin : 'https://goodebags.games',
      icons: ['https://goodebags.games/assets/goodebags-logo.png']
    }
  });
  return provider;
}

export async function connectWallet(walletKey, projectId) {
  const prov = await initProvider(projectId);
  const wallet = WALLET_META[walletKey];
  if (!wallet) throw new Error('Unknown wallet');

  const namespaces = {
    [wallet.chains[0].split(':')[0]]: {
      chains: wallet.chains,
      methods: [],
      events: []
    }
  };

  session = await prov.connect({
    namespaces,
    skipPairing: false
  });

  return {
    wallet: wallet.name,
    accounts: session.namespaces[wallet.chains[0].split(':')[0]]?.accounts || []
  };
}

export async function disconnectWallet() {
  if (provider && session) {
    await provider.disconnect();
    session = null;
  }
}

export function getConnection() {
  if (!session) return null;
  const nsKeys = Object.keys(session.namespaces);
  if (!nsKeys.length) return null;
  const accounts = session.namespaces[nsKeys[0]].accounts || [];
  return {
    accounts,
    wallet: 'WalletConnect'
  };
}

export function isConnected() {
  return !!session;
}

export const walletList = Object.entries(WALLET_META).map(([key, meta]) => ({
  key,
  name: meta.name,
  icon: meta.icon
}));
