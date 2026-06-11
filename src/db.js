const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'seedvault.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS seed_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_no TEXT UNIQUE NOT NULL,
      mother_tree TEXT NOT NULL,
      collection_year INTEGER NOT NULL,
      purity REAL NOT NULL,
      thousand_grain_weight REAL NOT NULL,
      storage_weight REAL NOT NULL,
      current_weight REAL NOT NULL,
      storage_location TEXT NOT NULL,
      storage_conditions TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_stock',
      germination_rate REAL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      inspection_type TEXT NOT NULL,
      germination_rate REAL,
      has_pest INTEGER,
      inspector TEXT,
      inspection_date TEXT DEFAULT (datetime('now', 'localtime')),
      notes TEXT,
      FOREIGN KEY (batch_id) REFERENCES seed_batches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS fumigations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      treatment_date TEXT DEFAULT (datetime('now', 'localtime')),
      method TEXT NOT NULL,
      duration_hours REAL NOT NULL,
      operator TEXT,
      result TEXT,
      notes TEXT,
      FOREIGN KEY (batch_id) REFERENCES seed_batches(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS outbound_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER NOT NULL,
      quantity REAL NOT NULL,
      purpose TEXT NOT NULL,
      recipient TEXT,
      operator TEXT,
      outbound_date TEXT DEFAULT (datetime('now', 'localtime')),
      notes TEXT,
      FOREIGN KEY (batch_id) REFERENCES seed_batches(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_batches_status ON seed_batches(status);
    CREATE INDEX IF NOT EXISTS idx_batches_year ON seed_batches(collection_year);
    CREATE INDEX IF NOT EXISTS idx_batches_mother ON seed_batches(mother_tree);
    CREATE INDEX IF NOT EXISTS idx_inspections_batch ON inspections(batch_id);
    CREATE INDEX IF NOT EXISTS idx_fumigations_batch ON fumigations(batch_id);
    CREATE INDEX IF NOT EXISTS idx_outbound_batch ON outbound_records(batch_id);
  `);
}

module.exports = { db, initDB };
