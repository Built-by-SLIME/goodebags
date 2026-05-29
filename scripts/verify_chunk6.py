checks = [
    ('public/js/wallet-utils.js',
     ['getWalletFromWC', 'WALLET_CONNECT_V2_INDEXED_DB'], []),
    ('public/games/apemodx/index.html', ['wallet-utils.js'], []),
    ('public/games/tbk/index.html',     ['wallet-utils.js'], []),
    ('public/games/apemodx/game.js',
     ['submitSessionScore','clearResultTimer','_resultTimer','keepCaller',
      'startGame(true)','/api/scores/amx','totalDealt','150-Math.round'],
     ['indexedDB.open']),
    ('public/games/tbk/game.js',
     ['submitSessionScore','clearResultTimer','_resultTimer','keepCaller',
      'startGame(true)','/api/scores/tbk','totalDealt','50-Math.round'],
     ['indexedDB.open']),
]
ok = True
for (f, have, not_have) in checks:
    src = open(f).read()
    for s in have:
        if s not in src:
            print('MISSING in', f, ':', s)
            ok = False
    for s in not_have:
        if s in src:
            print('STILL PRESENT in', f, ':', s)
            ok = False
print('All checks passed' if ok else 'SOME CHECKS FAILED')
