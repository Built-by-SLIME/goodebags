const { UniversalProvider } = require('@walletconnect/universal-provider');
const { WalletConnectModal } = require('@walletconnect/modal');

async function test() {
  try {
    console.log('Starting test...');
    const provider = await UniversalProvider.init({
      projectId: 'test-project-id-12345',
      relayUrl: 'wss://relay.walletconnect.com',
      metadata: {
        name: 'Test',
        description: 'Test',
        url: 'https://example.com',
        icons: []
      }
    });
    console.log('Provider initialized');

    const { uri, approval } = await provider.connect({
      namespaces: {
        hedera: {
          chains: ['hedera:mainnet'],
          methods: [],
          events: []
        }
      }
    });
    console.log('URI:', uri ? 'generated' : 'undefined');
    console.log('Approval is function:', typeof approval === 'function');

    const modal = new WalletConnectModal({
      projectId: 'test-project-id-12345',
      chains: ['hedera:mainnet'],
      enableExplorer: true
    });
    console.log('Modal created');
    console.log('openModal is function:', typeof modal.openModal === 'function');
  } catch (e) {
    console.error('Error:', e.message);
    console.error(e.stack);
  }
}

test();
