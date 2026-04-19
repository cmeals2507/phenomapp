/**
 * schema.js — SQLite table definitions for PhenomApp.
 *
 * CREATE TABLE IF NOT EXISTS is used so fresh installs get the full schema.
 * ALTER TABLE migrations at the bottom handle existing v1.0 databases safely.
 * All ALTER TABLEs are wrapped in try/catch — re-running is harmless.
 */

'use strict';

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transcripts (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_id  TEXT NOT NULL,
      raw_text        TEXT NOT NULL,
      workflow        TEXT NOT NULL,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(participant_id, workflow)
    );

    CREATE TABLE IF NOT EXISTS stage_outputs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      transcript_id   INTEGER NOT NULL,
      stage           TEXT NOT NULL,
      content         TEXT,
      day_stamps      TEXT,
      updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transcript_id) REFERENCES transcripts(id),
      UNIQUE(transcript_id, stage)
    );

    CREATE TABLE IF NOT EXISTS meaning_units (
      id                      INTEGER PRIMARY KEY AUTOINCREMENT,
      transcript_id           INTEGER NOT NULL,
      workflow                TEXT NOT NULL,
      mu_order                INTEGER NOT NULL,
      excerpt                 TEXT,
      boundary_justification  TEXT,
      paraphrase              TEXT,
      analyst_note            TEXT,
      provisional_theme       TEXT,
      theme_color             TEXT,
      stage3_notes            TEXT,
      day_stamps              TEXT,
      updated_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transcript_id) REFERENCES transcripts(id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS mu_reorder_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      transcript_id INTEGER NOT NULL,
      reordered_at  TEXT NOT NULL,
      order_snapshot TEXT NOT NULL,
      note          TEXT,
      FOREIGN KEY (transcript_id) REFERENCES transcripts(id)
    );

    CREATE TABLE IF NOT EXISTS project_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Migration: add new columns to existing databases.
  // safe to re-run — ALTER TABLE fails silently if column exists.
  const migrations = [
    'ALTER TABLE stage_outputs ADD COLUMN day_stamps TEXT',
    'ALTER TABLE meaning_units ADD COLUMN provisional_theme TEXT',
    'ALTER TABLE meaning_units ADD COLUMN theme_color TEXT',
    'ALTER TABLE meaning_units ADD COLUMN stage3_notes TEXT',
    'ALTER TABLE meaning_units ADD COLUMN day_stamps TEXT',
    'ALTER TABLE meaning_units ADD COLUMN assignment_rationale TEXT',
    'ALTER TABLE meaning_units ADD COLUMN thematic_interpretation TEXT',
  ];

  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* column already exists — ignore */ }
  }
}

module.exports = { initSchema };
