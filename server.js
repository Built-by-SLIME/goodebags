const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve the main website
app.use(express.static(path.join(__dirname, 'public')));

// Game routes — TBK (Hedera) and Ape Mod X (XRPL)
app.use('/games/tbk', express.static(path.join(__dirname, 'games', 'tbk')));
app.use('/games/apemodx', express.static(path.join(__dirname, 'games', 'apemodx')));

// Config endpoint for frontend env vars
app.get('/api/config', (req, res) => {
  res.json({
    walletConnectProjectId: process.env.WALLETCONNECT_PROJECT_ID || ''
  });
});

// Fallback to index.html for the root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Goodebag Games server running on port ${PORT}`);
});
