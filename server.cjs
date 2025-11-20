// Express backend with SQLite for Medical Coder data persistence

const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = 3009;

// Initialize SQLite database
const dbPath = path.join(__dirname, 'medical_coder.db');
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS cases (
    mrn TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    specialty TEXT,
    ground_truth TEXT,
    raw_text TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

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
  );

  CREATE TABLE IF NOT EXISTS saved_prompts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// === CASES API ===

// Get all cases
app.get('/api/cases', (req, res) => {
  try {
    const cases = db.prepare('SELECT * FROM cases ORDER BY updated_at DESC').all();
    const formatted = cases.map(c => ({
      mrn: c.mrn,
      status: c.status,
      specialty: c.specialty,
      ground_truth: c.ground_truth ? JSON.parse(c.ground_truth) : undefined,
      raw_text: c.raw_text,
      metadata: c.metadata ? JSON.parse(c.metadata) : undefined
    }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add or update a case
app.post('/api/cases', (req, res) => {
  try {
    const { mrn, status, specialty, ground_truth, raw_text, metadata } = req.body;

    const stmt = db.prepare(`
      INSERT INTO cases (mrn, status, specialty, ground_truth, raw_text, metadata, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(mrn) DO UPDATE SET
        status = excluded.status,
        specialty = COALESCE(excluded.specialty, cases.specialty),
        ground_truth = COALESCE(excluded.ground_truth, cases.ground_truth),
        raw_text = COALESCE(excluded.raw_text, cases.raw_text),
        metadata = excluded.metadata,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(
      mrn,
      status,
      specialty || null,
      ground_truth ? JSON.stringify(ground_truth) : null,
      raw_text || null,
      metadata ? JSON.stringify(metadata) : null
    );

    res.json({ success: true, mrn });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a case
app.patch('/api/cases/:mrn', (req, res) => {
  try {
    const { mrn } = req.params;
    const updates = req.body;

    const existing = db.prepare('SELECT * FROM cases WHERE mrn = ?').get(mrn);
    if (!existing) {
      return res.status(404).json({ error: 'Case not found' });
    }

    const stmt = db.prepare(`
      UPDATE cases SET
        status = ?,
        specialty = ?,
        ground_truth = ?,
        raw_text = ?,
        metadata = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE mrn = ?
    `);

    stmt.run(
      updates.status || existing.status,
      updates.specialty || existing.specialty,
      updates.ground_truth ? JSON.stringify(updates.ground_truth) : existing.ground_truth,
      updates.raw_text || existing.raw_text,
      updates.metadata ? JSON.stringify(updates.metadata) : existing.metadata,
      mrn
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a case
app.delete('/api/cases/:mrn', (req, res) => {
  try {
    const { mrn } = req.params;
    db.prepare('DELETE FROM cases WHERE mrn = ?').run(mrn);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === TEST RESULTS API ===

// Get all test results
app.get('/api/results', (req, res) => {
  try {
    const results = db.prepare('SELECT * FROM test_results ORDER BY timestamp DESC').all();
    const formatted = results.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      mrn: r.mrn,
      model: r.model,
      prompt_name: r.prompt_name,
      prompt_text: r.prompt_text,
      primary_match: Boolean(r.primary_match),
      cpt_recall: r.cpt_recall,
      missed_cpts: r.missed_cpts ? JSON.parse(r.missed_cpts) : [],
      hallucinated_cpts: r.hallucinated_cpts ? JSON.parse(r.hallucinated_cpts) : [],
      pred_primary: r.pred_primary,
      pred_cpts: r.pred_cpts ? JSON.parse(r.pred_cpts) : [],
      gold_primary: r.gold_primary,
      gold_cpts: r.gold_cpts ? JSON.parse(r.gold_cpts) : [],
      reasoning: r.reasoning
    }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a test result
app.post('/api/results', (req, res) => {
  try {
    const result = req.body;

    const stmt = db.prepare(`
      INSERT INTO test_results (
        id, timestamp, mrn, model, prompt_name, prompt_text,
        primary_match, cpt_recall, missed_cpts, hallucinated_cpts,
        pred_primary, pred_cpts, gold_primary, gold_cpts, reasoning
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      result.id,
      result.timestamp,
      result.mrn,
      result.model,
      result.prompt_name,
      result.prompt_text || null,
      result.primary_match ? 1 : 0,
      result.cpt_recall,
      JSON.stringify(result.missed_cpts || []),
      JSON.stringify(result.hallucinated_cpts || []),
      result.pred_primary,
      JSON.stringify(result.pred_cpts || []),
      result.gold_primary,
      JSON.stringify(result.gold_cpts || []),
      result.reasoning || null
    );

    res.json({ success: true, id: result.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a test result
app.delete('/api/results/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM test_results WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === SAVED PROMPTS API ===

// Get all saved prompts
app.get('/api/prompts', (req, res) => {
  try {
    const prompts = db.prepare('SELECT * FROM saved_prompts ORDER BY created_at DESC').all();
    const formatted = prompts.map(p => ({
      id: p.id,
      name: p.name,
      text: p.text,
      createdAt: p.created_at
    }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save a prompt (insert or update by name)
app.post('/api/prompts', (req, res) => {
  try {
    const { id, name, text, createdAt } = req.body;

    const stmt = db.prepare(`
      INSERT INTO saved_prompts (id, name, text, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        text = excluded.text
    `);

    stmt.run(id, name, text, createdAt);
    res.json({ success: true, id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a prompt
app.delete('/api/prompts/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM saved_prompts WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// === SETTINGS API ===

// Get a setting
app.get('/api/settings/:key', (req, res) => {
  try {
    const { key } = req.params;
    const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    res.json({ value: setting ? setting.value : null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Set a setting
app.put('/api/settings/:key', (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    db.prepare(`
      INSERT INTO settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Medical Coder API server running on http://localhost:${PORT}`);
  console.log(`Database: ${dbPath}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});
