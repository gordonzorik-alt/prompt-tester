// Database connection helper for Turso
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Initialize tables on first run
export async function initDb() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS cases (
      mrn TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      specialty TEXT,
      ground_truth TEXT,
      raw_text TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS test_results (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      mrn TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt_name TEXT NOT NULL,
      prompt_text TEXT,
      primary_match INTEGER NOT NULL,
      cpt_recall REAL NOT NULL,
      missed_cpts TEXT,
      hallucinated_cpts TEXT,
      pred_primary TEXT,
      pred_cpts TEXT,
      gold_primary TEXT,
      gold_cpts TEXT,
      reasoning TEXT
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS saved_prompts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
}

export { db };
