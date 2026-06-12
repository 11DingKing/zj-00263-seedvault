const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "..", "seedvault.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

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
      seedling_request_id INTEGER,
      source_type TEXT NOT NULL DEFAULT 'direct',
      FOREIGN KEY (batch_id) REFERENCES seed_batches(id) ON DELETE CASCADE,
      FOREIGN KEY (seedling_request_id) REFERENCES seedling_requests(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS seedling_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_no TEXT UNIQUE NOT NULL,
      batch_id INTEGER NOT NULL,
      requesting_unit TEXT NOT NULL,
      applicant TEXT NOT NULL,
      quantity REAL NOT NULL,
      purpose TEXT NOT NULL,
      purpose_detail TEXT,
      planned_use_date TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      approver TEXT,
      approval_notes TEXT,
      reject_reason TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime')),
      approved_at TEXT,
      outbound_record_id INTEGER,
      FOREIGN KEY (batch_id) REFERENCES seed_batches(id) ON DELETE CASCADE,
      FOREIGN KEY (outbound_record_id) REFERENCES outbound_records(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_batches_status ON seed_batches(status);
    CREATE INDEX IF NOT EXISTS idx_batches_year ON seed_batches(collection_year);
    CREATE INDEX IF NOT EXISTS idx_batches_mother ON seed_batches(mother_tree);
    CREATE INDEX IF NOT EXISTS idx_inspections_batch ON inspections(batch_id);
    CREATE INDEX IF NOT EXISTS idx_fumigations_batch ON fumigations(batch_id);
    CREATE INDEX IF NOT EXISTS idx_outbound_batch ON outbound_records(batch_id);
    CREATE INDEX IF NOT EXISTS idx_outbound_request ON outbound_records(seedling_request_id);
    CREATE INDEX IF NOT EXISTS idx_requests_batch ON seedling_requests(batch_id);
    CREATE INDEX IF NOT EXISTS idx_requests_status ON seedling_requests(status);
    CREATE INDEX IF NOT EXISTS idx_requests_unit ON seedling_requests(requesting_unit);
    CREATE INDEX IF NOT EXISTS idx_requests_purpose ON seedling_requests(purpose);
  `);

  const columns = db
    .prepare("PRAGMA table_info(outbound_records)")
    .all()
    .map((c) => c.name);
  if (!columns.includes("seedling_request_id")) {
    db.exec(`
      ALTER TABLE outbound_records ADD COLUMN seedling_request_id INTEGER;
      ALTER TABLE outbound_records ADD COLUMN source_type TEXT NOT NULL DEFAULT 'direct';
    `);
  }
}

module.exports = { db, initDB };
