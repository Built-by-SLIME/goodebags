/* ── Shared: WalletConnect wallet address reader ────────────────────────────
   Reads the connected wallet address directly from WalletConnect v2 IndexedDB.
   No network request — purely a local storage read.
   Included by both apemodx/game.js and tbk/game.js.

   Usage:
     const address = await getWalletFromWC();   // returns string | null
─────────────────────────────────────────────────────────────────────────── */
function getWalletFromWC() {
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
                for (const ns of Object.values(session.namespaces)) {
                  if (ns.accounts?.length) {
                    // Account format: "chain:networkId:address"
                    const parts = ns.accounts[0].split(':');
                    resolve(parts[parts.length - 1] || null);
                    return;
                  }
                }
              }
              resolve(null);
            } catch(e) { resolve(null); }
          };
        };
      };
    } catch(e) { resolve(null); }
  });
}
