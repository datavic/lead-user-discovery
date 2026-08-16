-- D1 schema for the scheduled lead-user sweep.
--
-- Apply locally:  npx wrangler d1 execute lead-user-db --local  --file=./schema.sql
-- Apply remotely: npx wrangler d1 execute lead-user-db --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS sweeps (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  topic      TEXT NOT NULL,
  started_at TEXT NOT NULL,
  notes      TEXT
);

CREATE TABLE IF NOT EXISTS findings (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  sweep_id              INTEGER NOT NULL REFERENCES sweeps(id) ON DELETE CASCADE,
  url                   TEXT NOT NULL,
  source                TEXT NOT NULL,
  author                TEXT,
  title                 TEXT,
  problem               TEXT,
  self_built_solution   TEXT,
  solubility_score      INTEGER,
  expected_benefit_score INTEGER,
  theme                 TEXT,
  reasoning             TEXT,
  posted_at             TEXT,
  first_seen_at         TEXT NOT NULL
);

-- One row per URL per sweep, so re-running a topic the same day is idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS findings_sweep_url ON findings (sweep_id, url);

-- Drives the "new since last sweep" view: has this URL ever been seen before?
CREATE INDEX IF NOT EXISTS findings_url ON findings (url);
CREATE INDEX IF NOT EXISTS findings_theme ON findings (theme);
CREATE INDEX IF NOT EXISTS sweeps_topic_started ON sweeps (topic, started_at DESC);
