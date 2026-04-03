function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS transcripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      participant_id TEXT NOT NULL,
      raw_text TEXT NOT NULL,
      workflow TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(participant_id, workflow)
    );

    CREATE TABLE IF NOT EXISTS stage_outputs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transcript_id INTEGER NOT NULL,
      stage TEXT NOT NULL,
      content TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transcript_id) REFERENCES transcripts(id),
      UNIQUE(transcript_id, stage)
    );

    CREATE TABLE IF NOT EXISTS meaning_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transcript_id INTEGER NOT NULL,
      workflow TEXT NOT NULL,
      mu_order INTEGER NOT NULL,
      excerpt TEXT,
      boundary_justification TEXT,
      paraphrase TEXT,
      analyst_note TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transcript_id) REFERENCES transcripts(id)
    );
  `);
}

module.exports = { initSchema };
