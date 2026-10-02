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
// Query public Ripple nodes. xrplcluster.com returns HTTP 402 from cloud IPs,
// so we use s1/s2.ripple.com which serve validated ledger data.
app.post('/api/check-amx-nft', async (req, res) => {
  const { account } = req.body;
  if (!account) return res.status(400).json({ error: 'missing account' });

  const endpoints = [
    'https://s1.ripple.com:51234/',
    'https://s2.ripple.com:51234/'
  ];

  let lastError = null;
  for (const url of endpoints) {
    try {
      let marker = undefined;
      let page = 0;
      const MAX_PAGES = 20;
      while (page < MAX_PAGES) {
        const params = { account };
        if (marker) params.marker = marker;
        const data = await fetchJson(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method: 'account_nfts', params: [params] })
        });

        // XRPL JSON-RPC returns HTTP 200 even for ledger errors.
        if (data.result?.status === 'error') {
          // actNotFound means the account has no NFTs (and never has).
          if (data.result?.error === 'actNotFound') {
            return res.json({ hasNft: false });
          }
          throw new Error(`XRPL error: ${data.result?.error || 'unknown'}`);
        }

        const nfts = data.result?.account_nfts || [];
        if (nfts.some(nft => nft.NFTokenTaxon === AMX_TAXON)) {
          return res.json({ hasNft: true });
        }
        marker = data.result?.marker;
        if (!marker) {
          // Definitive empty result from a working node.
          return res.json({ hasNft: false });
        }
        page++;
      }
    } catch (e) {
      lastError = e.message;
      console.error('[API] AMX NFT check failed for', url, e.message);
    }
  }

  // Every endpoint failed — we couldn't get a definitive answer.
  // Don't falsely claim the user has no NFT.
  console.error('[API] AMX NFT check: all endpoints failed. Last error:', lastError);
  res.status(503).json({ error: 'verification_unavailable', hasNft: false });
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
// played_at is a naive TIMESTAMP written by NOW() in the DB session timezone,
// so it is converted back with the server's own TimeZone setting before
// shifting to UK time. Europe/London handles the GMT/BST switch. Monthly
// Tournaments run per UK calendar month; winners history starts July 2026.
const UK_TZ = 'Europe/London';
const TOURNAMENT_START = `timestamp '2026-07-01 00:00'`;
const LONDON_TIME = `s.played_at AT TIME ZONE current_setting('TimeZone') AT TIME ZONE '${UK_TZ}'`;
const LONDON_MONTH = `date_trunc('month', ${LONDON_TIME})`;

async function getLeaderboard(table, req, res) {
  const opponents = req.query.opponents;
  let sql, params = [];
  if (req.query.period === 'monthly') {
    // Monthly Tournament: best single score per user within the current UK
    // calendar month; tied scores rank earliest-first.
    sql = `SELECT * FROM (
             SELECT DISTINCT ON (u.id) u.username, s.score, s.opponents, s.played_at
             FROM ${table} s JOIN users u ON u.id = s.user_id
             WHERE ${LONDON_TIME} >= ${TOURNAMENT_START}
               AND ${LONDON_MONTH} = date_trunc('month', now() AT TIME ZONE '${UK_TZ}')
             ORDER BY u.id, s.score DESC, s.played_at ASC
           ) best
           ORDER BY score DESC, played_at ASC LIMIT 50`;
  } else if (opponents) {
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

// Previous Monthly Tournament winners: one per completed UK month since the
// tournament start (highest best-single-score, earliest tie-break).
async function getMonthlyWinners(table, req, res) {
  const sql = `WITH london AS (
    SELECT s.*, ${LONDON_MONTH} AS lmonth
    FROM ${table} s
    WHERE ${LONDON_TIME} >= ${TOURNAMENT_START}
      AND ${LONDON_MONTH} < date_trunc('month', now() AT TIME ZONE '${UK_TZ}')
  ),
  best_per_user AS (
    SELECT DISTINCT ON (lmonth, user_id) lmonth, user_id, score, opponents, played_at
    FROM london
    ORDER BY lmonth, user_id, score DESC, played_at ASC
  ),
  winner AS (
    SELECT DISTINCT ON (lmonth) lmonth, user_id, score, opponents, played_at
    FROM best_per_user
    ORDER BY lmonth, score DESC, played_at ASC
  )
  SELECT to_char(w.lmonth, 'FMMonth') AS month, to_char(w.lmonth, 'YYYY') AS year,
         u.username, w.score, w.opponents
  FROM winner w JOIN users u ON u.id = w.user_id
  ORDER BY w.lmonth DESC`;
  const r = await query(sql);
  res.json(r ? r.rows : []);
}

app.get('/api/leaderboard/amx/winners', (req, res) => getMonthlyWinners('amx_scores', req, res));
app.get('/api/leaderboard/tbk/winners', (req, res) => getMonthlyWinners('tbk_scores', req, res));

// ── Root fallback ─────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Goodebags server running on port ${PORT}`));

