const express = require('express');
const path    = require('path');
const { Pool } = require('pg');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Database ─────────────────────────────────────────────
const db = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

async function query(sql, params) {
  if (!db) return null;
  try { return await db.query(sql, params); }
  catch (e) { console.error('[DB]', e.message); return null; }
}

// ── Middleware ────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Config ───────────────────────────────────────────────
app.get('/api/config', (req, res) => {
  res.json({
    walletConnectProjectId: process.env.WALLETCONNECT_PROJECT_ID || '',
    xamanApiKey: process.env.XAMAN_API_KEY || '',
    r2BaseUrl: process.env.R2_BASE_URL || ''
  });
});

// ── Users ─────────────────────────────────────────────────
// GET /api/user/:wallet  — look up existing account
app.get('/api/user/:wallet', async (req, res) => {
  const r = await query('SELECT * FROM users WHERE wallet_address = $1', [req.params.wallet.toLowerCase()]);
  if (!r || r.rows.length === 0) return res.status(404).json({ error: 'not_found' });
  res.json(r.rows[0]);
});

// POST /api/user  — register new account
app.post('/api/user', async (req, res) => {
  const { walletAddress, username } = req.body;
  if (!walletAddress || !username) return res.status(400).json({ error: 'missing fields' });
  const clean = username.trim().slice(0, 30);
  const wallet = walletAddress.toLowerCase();
  const r = await query(
    'INSERT INTO users (wallet_address, username) VALUES ($1, $2) ON CONFLICT (wallet_address) DO UPDATE SET username=$2 RETURNING *',
    [wallet, clean]
  );
  if (!r) return res.status(503).json({ error: 'db_unavailable' });
  res.json(r.rows[0]);
});

// ── Scores ────────────────────────────────────────────────
async function submitScore(table, req, res) {
  const { walletAddress, score, opponents } = req.body;
  if (!walletAddress || score == null) return res.status(400).json({ error: 'missing fields' });
  const wallet = walletAddress.toLowerCase();
  // look up user
  const u = await query('SELECT id FROM users WHERE wallet_address=$1', [wallet]);
  if (!u || u.rows.length === 0) return res.status(404).json({ error: 'user_not_found' });
  const userId = u.rows[0].id;
  const r = await query(
    `INSERT INTO ${table} (user_id, score, opponents) VALUES ($1,$2,$3) RETURNING *`,
    [userId, score, opponents || 1]
  );
  if (!r) return res.status(503).json({ error: 'db_unavailable' });
  res.json(r.rows[0]);
}

app.post('/api/scores/amx', (req, res) => submitScore('amx_scores', req, res));
app.post('/api/scores/tbk', (req, res) => submitScore('tbk_scores', req, res));

// ── Token / NFT gating ────────────────────────────────────
// These checks are done server-side to avoid CORS issues with public nodes.

const AMX_TAXON = 777;
const TBK_TOKEN_ID = '0.0.7295055';

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// POST /api/check-amx-nft  { account }
app.post('/api/check-amx-nft', async (req, res) => {
  const { account } = req.body;
  if (!account) return res.status(400).json({ error: 'missing account' });
  try {
    let marker = undefined;
    let page = 0;
    const MAX_PAGES = 20;
    while (page < MAX_PAGES) {
      const params = { account };
      if (marker) params.marker = marker;
      const data = await fetchJson('https://xrplcluster.com/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'account_nfts', params: [params] })
      });
      const nfts = data.result?.account_nfts || [];
      if (nfts.some(nft => nft.NFTokenTaxon === AMX_TAXON)) {
        return res.json({ hasNft: true });
      }
      marker = data.result?.marker;
      if (!marker) break;
      page++;
    }
    res.json({ hasNft: false });
  } catch (e) {
    console.error('[API] AMX NFT check failed:', e.message);
    res.status(502).json({ error: 'nft_check_failed', hasNft: false });
  }
});

// POST /api/check-tbk-token  { account }
app.post('/api/check-tbk-token', async (req, res) => {
  const { account } = req.body;
  if (!account) return res.status(400).json({ error: 'missing account' });
  const endpoints = [
    `https://mainnet-public.mirrornode.hedera.com/api/v1/accounts/${encodeURIComponent(account)}/tokens?token.id=${TBK_TOKEN_ID}`,
    `https://testnet.mirrornode.hedera.com/api/v1/accounts/${encodeURIComponent(account)}/tokens?token.id=${TBK_TOKEN_ID}`
  ];
  for (const url of endpoints) {
    try {
      const data = await fetchJson(url);
      if (data.tokens && data.tokens.some(t => t.token_id === TBK_TOKEN_ID)) {
        return res.json({ hasToken: true });
      }
    } catch (e) {
      console.error('[API] TBK token check failed for', url, e.message);
    }
  }
  res.json({ hasToken: false });
});

// ── Leaderboards ──────────────────────────────────────────
async function getLeaderboard(table, req, res) {
  const opponents = req.query.opponents;
  let sql, params = [];
  if (opponents) {
    // Best score per user for a specific opponent count
    sql = `SELECT u.username, MAX(s.score) as score, s.opponents
           FROM ${table} s JOIN users u ON u.id = s.user_id
           WHERE s.opponents = $1
           GROUP BY u.id, u.username, s.opponents
           ORDER BY MAX(s.score) DESC LIMIT 50`;
    params = [parseInt(opponents, 10)];
  } else {
    // All-time best score per user across all opponent counts
    sql = `SELECT * FROM (
             SELECT DISTINCT ON (u.id) u.username, s.score, s.opponents
             FROM ${table} s JOIN users u ON u.id = s.user_id
             ORDER BY u.id, s.score DESC
           ) best
           ORDER BY score DESC LIMIT 50`;
  }
  const r = await query(sql, params);
  res.json(r ? r.rows : []);
}

app.get('/api/leaderboard/amx', (req, res) => getLeaderboard('amx_scores', req, res));
app.get('/api/leaderboard/tbk', (req, res) => getLeaderboard('tbk_scores', req, res));

// ── Root fallback ─────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Goodebags server running on port ${PORT}`));

