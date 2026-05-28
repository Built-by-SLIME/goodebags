-- Goodebags Games — PostgreSQL Schema
-- Run this once against your Railway Postgres DB

CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  wallet_address VARCHAR(255) UNIQUE NOT NULL,
  username       VARCHAR(30)  UNIQUE NOT NULL,
  created_at     TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS amx_scores (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  score      INTEGER NOT NULL,
  opponents  INTEGER NOT NULL DEFAULT 1,
  played_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tbk_scores (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  score      INTEGER NOT NULL,
  opponents  INTEGER NOT NULL DEFAULT 1,
  played_at  TIMESTAMP DEFAULT NOW()
);

-- Indexes for fast leaderboard queries
CREATE INDEX IF NOT EXISTS idx_amx_score ON amx_scores(score DESC);
CREATE INDEX IF NOT EXISTS idx_tbk_score ON tbk_scores(score DESC);
