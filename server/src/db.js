import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(config.dataDir, 'platform.sqlite'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  country TEXT NOT NULL DEFAULT 'UZ',              -- decides the call/result language
  status TEXT NOT NULL DEFAULT 'active',          -- active | suspended
  notes TEXT DEFAULT '',
  custom_fields TEXT NOT NULL DEFAULT '[]',        -- default CRM field definitions (JSON array)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,                              -- per_minute | package
  price_per_minute INTEGER NOT NULL DEFAULT 0,     -- so'm, per_minute plans
  included_minutes INTEGER NOT NULL DEFAULT 0,     -- package plans
  price INTEGER NOT NULL DEFAULT 0,                -- package price, so'm
  validity_days INTEGER,                           -- package validity, NULL = unlimited
  description TEXT DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  plan_name TEXT NOT NULL,
  type TEXT NOT NULL,                              -- per_minute | package
  price_per_minute INTEGER NOT NULL DEFAULT 0,
  included_seconds INTEGER NOT NULL DEFAULT 0,
  used_seconds INTEGER NOT NULL DEFAULT 0,
  price INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active',           -- active | exhausted | expired | cancelled
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,                         -- + top-up, - charge (so'm)
  kind TEXT NOT NULL,                              -- topup | charge | adjustment | package
  note TEXT DEFAULT '',
  analysis_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'default',
  token_hash TEXT NOT NULL UNIQUE,
  token_prefix TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS analyses (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  token_id TEXT,
  subscription_id TEXT,
  external_id TEXT DEFAULT '',
  file_name TEXT DEFAULT '',
  mime_type TEXT DEFAULT '',
  file_bytes INTEGER NOT NULL DEFAULT 0,
  duration_seconds REAL NOT NULL DEFAULT 0,
  billed_seconds INTEGER NOT NULL DEFAULT 0,
  cost INTEGER NOT NULL DEFAULT 0,
  billing_type TEXT DEFAULT '',
  status TEXT NOT NULL,                            -- done | failed
  error TEXT,
  model TEXT DEFAULT '',
  processing_ms INTEGER NOT NULL DEFAULT 0,
  title TEXT DEFAULT '',
  overall_score REAL,
  overall_grade TEXT DEFAULT '',
  custom_fields TEXT DEFAULT '{}',                 -- values filled from the audio (JSON object)
  result TEXT,                                     -- full analysis JSON
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_analyses_company ON analyses(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_company ON ledger(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subs_company ON subscriptions(company_id, status);
`);

// Added after the first release: token usage and Gemini cost per analysis
for (const col of ['input_tokens INTEGER NOT NULL DEFAULT 0', 'output_tokens INTEGER NOT NULL DEFAULT 0', 'thought_tokens INTEGER NOT NULL DEFAULT 0', 'ai_cost_usd REAL NOT NULL DEFAULT 0']) {
  try {
    db.exec(`ALTER TABLE analyses ADD COLUMN ${col}`);
  } catch {
    // column already exists
  }
}

// Payments live in the ledger: `paid` is the money actually received, `amount` its effect on the prepaid balance
for (const col of ['paid INTEGER NOT NULL DEFAULT 0', 'subscription_id TEXT', 'method TEXT DEFAULT \'\'', 'paid_at TEXT']) {
  try {
    db.exec(`ALTER TABLE ledger ADD COLUMN ${col}`);
  } catch {
    // column already exists
  }
}
db.exec("UPDATE ledger SET paid = amount WHERE kind = 'topup' AND paid = 0 AND amount > 0");
db.exec('UPDATE ledger SET paid_at = created_at WHERE paid_at IS NULL');
// Package payments recorded before the `paid` column: recover the amount from the note and link the subscription
for (const row of db.prepare("SELECT id, company_id, note, created_at FROM ledger WHERE kind = 'package' AND paid = 0").all()) {
  const m = /\((\d[\d\s]*)\s*so/.exec(row.note || '');
  const sub = db
    .prepare(
      `SELECT id, price FROM subscriptions WHERE company_id = ? AND type = 'package'
         AND id NOT IN (SELECT subscription_id FROM ledger WHERE subscription_id IS NOT NULL)
       ORDER BY abs(julianday(created_at) - julianday(?)) LIMIT 1`
    )
    .get(row.company_id, row.created_at);
  const paid = m ? Number(m[1].replace(/\s/g, '')) : sub?.price || 0;
  db.prepare('UPDATE ledger SET paid = ?, subscription_id = COALESCE(subscription_id, ?) WHERE id = ?').run(paid, sub?.id ?? null, row.id);
}

// Output language per company ('' = same as the country language)
try {
  db.exec("ALTER TABLE companies ADD COLUMN output_language TEXT NOT NULL DEFAULT ''");
} catch {
  // column already exists
}

// 10-point rating per analysis
try {
  db.exec('ALTER TABLE analyses ADD COLUMN rating_score REAL');
} catch {
  // column already exists
}

// One-time fix: analyses where the model returned overallScore on a 10-point scale
try {
  db.exec(`UPDATE analyses SET overall_score = overall_score * 10,
             result = json_set(result, '$.callSummary.overallScore', round(overall_score * 10))
           WHERE status = 'done' AND overall_score > 0 AND overall_score <= 10 AND rating_score IS NOT NULL`);
} catch (e) {
  console.warn('overall_score fix skipped:', e.message);
}

// Company portal login (email + scrypt password hash)
for (const col of ["portal_email TEXT NOT NULL DEFAULT ''", "portal_password_hash TEXT NOT NULL DEFAULT ''"]) {
  try {
    db.exec(`ALTER TABLE companies ADD COLUMN ${col}`);
  } catch {
    // column already exists
  }
}

// Sales script per company and the adherence score per analysis
for (const [table, col] of [['companies', "script TEXT NOT NULL DEFAULT ''"], ['analyses', 'script_score REAL']]) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col}`);
  } catch {
    // column already exists
  }
}

export const q = {
  one: (sql, ...params) => db.prepare(sql).get(...params),
  all: (sql, ...params) => db.prepare(sql).all(...params),
  run: (sql, ...params) => db.prepare(sql).run(...params),
};

export const tx = (fn) => {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
};
