import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';

let modal = null;
let currentProjectId = null;

const metadata = {
  name: 'Goodebags Games',
  description: 'Collect. Play. Compete.',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://goodebags.games',
  icons: ['https://goodebags.games/assets/goodebags-logo.png']
};

const networks = [
  { id: 'hedera:mainnet', chainId: 'hedera:mainnet', chainNamespace: 'hedera', name: 'Hedera Mainnet', nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 8 } },
  { id: 'hedera:testnet', chainId: 'hedera:testnet', chainNamespace: 'hedera', name: 'Hedera Testnet', nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 8 } },
  { id: 'xrpl:0', chainId: 'xrpl:0', chainNamespace: 'xrpl', name: 'XRPL Mainnet', nativeCurrency: { name: 'XRP', symbol: 'XRP', decimals: 6 } },
  { id: 'xrpl:1', chainId: 'xrpl:1', chainNamespace: 'xrpl', name: 'XRPL Testnet', nativeCurrency: { name: 'XRP', symbol: 'XRP', decimals: 6 } }
];

function initModal(projectId) {
  if (modal && currentProjectId === projectId) return modal;
  currentProjectId = projectId;

  const ethersAdapter = new EthersAdapter();

  modal = createAppKit({
    adapters: [ethersAdapter],
    networks: networks,
    metadata: metadata,
    projectId: projectId,
    features: {
      analytics: false,
      email: false,
      socials: false
    }
  });

  return modal;
}

export function openWalletModal(projectId) {
  const m = initModal(projectId);
  m.open();
}

export function closeWalletModal() {
  if (modal) {
    modal.close();
  }
}

export function subscribeConnection(callback) {
  if (!modal) return () => {};
  return modal.subscribeState((state) => {
    callback({
      open: state.open,
      selectedNetworkId: state.selectedNetworkId,
      isConnected: state.isConnected
    });
  });
}

export function getConnection() {
  if (!modal) return null;
  const state = modal.getState ? modal.getState() : {};
  return {
    isConnected: state.isConnected || false,
    address: state.address || null,
    chainId: state.selectedNetworkId || null
  };
}

export function isConnected() {
  if (!modal) return false;
  const state = modal.getState ? modal.getState() : {};
  return !!state.isConnected;
}

export async function disconnectWallet() {
  if (modal && modal.disconnect) {
    await modal.disconnect();
  }
}
