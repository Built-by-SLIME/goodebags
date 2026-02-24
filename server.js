const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve the main website
app.use(express.static(path.join(__dirname, 'public')));

// Game routes — games will live in /games/game1 and /games/game2
app.use('/games/game1', express.static(path.join(__dirname, 'games', 'game1')));
app.use('/games/game2', express.static(path.join(__dirname, 'games', 'game2')));

// Fallback to index.html for the root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Goodebag Games server running on port ${PORT}`);
});
