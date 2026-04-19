'use strict';

let db;

function setDb(database) {
  db = database;
}

// ---------------------------------------------------------------------------
// Transcripts
// ---------------------------------------------------------------------------

function getAllTranscripts() {
  return db.prepare(`
    SELECT
      t.id,
      t.participant_id,
      t.workflow,
      t.created_at,
      (CASE WHEN EXISTS(
        SELECT 1 FROM stage_outputs so WHERE so.transcript_id = t.id
          AND so.stage = 'memo' AND so.content IS NOT NULL AND so.content != ''
      ) THEN 1 ELSE 0 END) AS has_memo,
      (CASE WHEN EXISTS(
        SELECT 1 FROM meaning_units mu WHERE mu.transcript_id = t.id
      ) THEN 1 ELSE 0 END) AS has_meaning_units,
      (CASE WHEN EXISTS(
        SELECT 1 FROM meaning_units mu2 WHERE mu2.transcript_id = t.id
          AND mu2.provisional_theme IS NOT NULL AND mu2.provisional_theme != ''
      ) THEN 1 ELSE 0 END) AS has_themes,
      (CASE WHEN EXISTS(
        SELECT 1 FROM stage_outputs so2 WHERE so2.transcript_id = t.id
          AND so2.stage = 'whole_part' AND so2.content IS NOT NULL AND so2.content != ''
      ) THEN 1 ELSE 0 END) AS has_whole_part,
      (CASE WHEN EXISTS(
        SELECT 1 FROM stage_outputs so3 WHERE so3.transcript_id = t.id
          AND so3.stage = 'essence' AND so3.content IS NOT NULL AND so3.content != ''
      ) THEN 1 ELSE 0 END) AS has_essence
    FROM transcripts t
    ORDER BY t.participant_id, t.workflow
  `).all();
}

function getTranscript(id) {
  return db.prepare('SELECT * FROM transcripts WHERE id = ?').get(id);
}

function deleteTranscript(id) {
  db.transaction(() => {
    db.prepare('DELETE FROM mu_reorder_log WHERE transcript_id = ?').run(id);
    db.prepare('DELETE FROM meaning_units WHERE transcript_id = ?').run(id);
    db.prepare('DELETE FROM stage_outputs WHERE transcript_id = ?').run(id);
    db.prepare('DELETE FROM transcripts WHERE id = ?').run(id);
  })();
}

function importTranscript({ participantId, workflow, rawText }) {
  const result = db.prepare(
    'INSERT INTO transcripts (participant_id, workflow, raw_text) VALUES (?, ?, ?)'
  ).run(participantId, workflow, rawText);

  const transcriptId = result.lastInsertRowid;
  const insertStage = db.prepare(
    'INSERT OR IGNORE INTO stage_outputs (transcript_id, stage, content, day_stamps) VALUES (?, ?, ?, ?)'
  );
  for (const stage of ['memo', 'whole_part', 'essence']) {
    insertStage.run(transcriptId, stage, '', '[]');
  }

  return { id: transcriptId };
}

// ---------------------------------------------------------------------------
// Stage outputs
// ---------------------------------------------------------------------------

function getStageOutput(transcriptId, stage) {
  return db.prepare(
    'SELECT * FROM stage_outputs WHERE transcript_id = ? AND stage = ?'
  ).get(transcriptId, stage);
}

function getAllStageOutputs(transcriptId) {
  return db.prepare(
    'SELECT * FROM stage_outputs WHERE transcript_id = ? ORDER BY stage'
  ).all(transcriptId);
}

function saveStageOutput(transcriptId, stage, content, dayStamps) {
  db.prepare(`
    INSERT INTO stage_outputs (transcript_id, stage, content, day_stamps, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(transcript_id, stage) DO UPDATE SET
      content = excluded.content,
      day_stamps = excluded.day_stamps,
      updated_at = CURRENT_TIMESTAMP
  `).run(transcriptId, stage, content, dayStamps);
}

// ---------------------------------------------------------------------------
// Meaning units
// ---------------------------------------------------------------------------

function getMeaningUnits(transcriptId) {
  return db.prepare(
    'SELECT * FROM meaning_units WHERE transcript_id = ? ORDER BY mu_order'
  ).all(transcriptId);
}

function getMeaningUnitById(id) {
  return db.prepare('SELECT * FROM meaning_units WHERE id = ?').get(id);
}

function addMeaningUnit(transcriptId, workflow, dayStamps) {
  const { max_order } = db.prepare(
    'SELECT COALESCE(MAX(mu_order), 0) as max_order FROM meaning_units WHERE transcript_id = ?'
  ).get(transcriptId);

  const result = db.prepare(
    'INSERT INTO meaning_units (transcript_id, workflow, mu_order, day_stamps) VALUES (?, ?, ?, ?)'
  ).run(transcriptId, workflow, max_order + 1, dayStamps);

  return db.prepare('SELECT * FROM meaning_units WHERE id = ?').get(result.lastInsertRowid);
}

function insertMeaningUnit(transcriptId, workflow, dayStamps, insertAtOrder) {
  let newId;
  db.transaction(() => {
    db.prepare(
      'UPDATE meaning_units SET mu_order = mu_order + 1 WHERE transcript_id = ? AND mu_order >= ?'
    ).run(transcriptId, insertAtOrder);

    const result = db.prepare(
      'INSERT INTO meaning_units (transcript_id, workflow, mu_order, day_stamps) VALUES (?, ?, ?, ?)'
    ).run(transcriptId, workflow, insertAtOrder, dayStamps);

    newId = result.lastInsertRowid;
  })();

  return db.prepare('SELECT * FROM meaning_units WHERE id = ?').get(newId);
}

function saveMeaningUnit(mu) {
  db.prepare(`
    UPDATE meaning_units SET
      excerpt = ?,
      boundary_justification = ?,
      paraphrase = ?,
      analyst_note = ?,
      provisional_theme = ?,
      theme_color = ?,
      stage3_notes = ?,
      thematic_interpretation = ?,
      day_stamps = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    mu.excerpt || null,
    mu.boundary_justification || null,
    mu.paraphrase || null,
    mu.analyst_note || null,
    mu.provisional_theme || null,
    mu.theme_color || null,
    mu.stage3_notes || null,
    mu.thematic_interpretation || null,
    mu.day_stamps || null,
    mu.id
  );
}

function saveMeaningUnitColor({ id, theme_color }) {
  db.prepare(
    'UPDATE meaning_units SET theme_color = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(theme_color || null, id);
}

function deleteMeaningUnit(id) {
  db.prepare('DELETE FROM meaning_units WHERE id = ?').run(id);
}

function reorderMeaningUnits(items) {
  const update = db.prepare('UPDATE meaning_units SET mu_order = ? WHERE id = ?');
  db.transaction((items) => {
    for (const item of items) update.run(item.mu_order, item.id);
  })(items);
}

// ---------------------------------------------------------------------------
// Theme highlighting
// ---------------------------------------------------------------------------

function getMeaningUnitExcerpts(transcriptId) {
  return db.prepare(
    "SELECT excerpt, mu_order FROM meaning_units WHERE transcript_id = ? AND excerpt IS NOT NULL AND excerpt != '' ORDER BY mu_order"
  ).all(transcriptId);
}

/**
 * Returns rows eligible for transcript highlighting.
 * Gate: excerpt + provisional_theme + theme_color + non-empty thematic_interpretation.
 */
function getHighlightData(transcriptId) {
  return db.prepare(`
    SELECT id AS mu_id, mu_order, excerpt, provisional_theme, theme_color
    FROM meaning_units
    WHERE transcript_id = ?
      AND excerpt IS NOT NULL AND excerpt != ''
      AND provisional_theme IS NOT NULL AND provisional_theme != ''
      AND TRIM(COALESCE(thematic_interpretation, '')) != ''
    ORDER BY mu_order
  `).all(transcriptId);
}

// ---------------------------------------------------------------------------
// Reorder log
// ---------------------------------------------------------------------------

function logMUReorder({ transcriptId, reorderedAt, orderSnapshot }) {
  const result = db.prepare(
    'INSERT INTO mu_reorder_log (transcript_id, reordered_at, order_snapshot) VALUES (?, ?, ?)'
  ).run(transcriptId, reorderedAt, orderSnapshot);
  return result.lastInsertRowid;
}

function updateReorderLogNote({ id, note }) {
  db.prepare('UPDATE mu_reorder_log SET note = ? WHERE id = ?').run(note || null, id);
}

function getReorderLog(transcriptId) {
  return db.prepare(
    'SELECT * FROM mu_reorder_log WHERE transcript_id = ? ORDER BY reordered_at DESC'
  ).all(transcriptId);
}

function getAllReorderLogsForCorpus() {
  return db.prepare(
    'SELECT id, transcript_id, reordered_at, order_snapshot, note FROM mu_reorder_log ORDER BY transcript_id, reordered_at'
  ).all();
}

// ---------------------------------------------------------------------------
// Project meta / positionality
// ---------------------------------------------------------------------------

function getPositionality() {
  const text = db.prepare("SELECT value FROM project_meta WHERE key = 'positionality'").get();
  const createdAt = db.prepare("SELECT value FROM project_meta WHERE key = 'positionality_created_at'").get();
  const updatedAt = db.prepare("SELECT value FROM project_meta WHERE key = 'positionality_updated_at'").get();
  return {
    text: text?.value || '',
    created_at: createdAt?.value || null,
    updated_at: updatedAt?.value || null,
  };
}

function savePositionality(text, now) {
  const existing = db.prepare("SELECT value FROM project_meta WHERE key = 'positionality_created_at'").get();
  const upsert = db.prepare(
    "INSERT INTO project_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  );
  db.transaction(() => {
    upsert.run('positionality', text);
    if (!existing) upsert.run('positionality_created_at', now);
    upsert.run('positionality_updated_at', now);
  })();
}

// ---------------------------------------------------------------------------
// Corpus export queries
// ---------------------------------------------------------------------------

function getAllStageOutputsForCorpus() {
  return db.prepare(`
    SELECT t.participant_id, t.workflow, so.stage, so.content, so.day_stamps, so.updated_at
    FROM stage_outputs so
    JOIN transcripts t ON t.id = so.transcript_id
    WHERE so.stage IN ('memo', 'whole_part', 'essence')
    ORDER BY t.participant_id, t.workflow, so.stage
  `).all();
}

function getAllMeaningUnitsForCorpus() {
  return db.prepare(`
    SELECT
      t.participant_id, mu.workflow, mu.mu_order,
      mu.excerpt, mu.boundary_justification, mu.paraphrase, mu.analyst_note,
      mu.provisional_theme, mu.theme_color, mu.thematic_interpretation, mu.stage3_notes,
      mu.day_stamps, mu.updated_at
    FROM meaning_units mu
    JOIN transcripts t ON t.id = mu.transcript_id
    ORDER BY t.participant_id, mu.workflow, mu.mu_order
  `).all();
}

module.exports = {
  setDb,
  getAllTranscripts,
  getTranscript,
  deleteTranscript,
  importTranscript,
  getStageOutput,
  getAllStageOutputs,
  saveStageOutput,
  getMeaningUnits,
  getMeaningUnitById,
  addMeaningUnit,
  insertMeaningUnit,
  saveMeaningUnit,
  saveMeaningUnitColor,
  deleteMeaningUnit,
  reorderMeaningUnits,
  getMeaningUnitExcerpts,
  getHighlightData,
  logMUReorder,
  updateReorderLogNote,
  getReorderLog,
  getAllReorderLogsForCorpus,
  getPositionality,
  savePositionality,
  getAllStageOutputsForCorpus,
  getAllMeaningUnitsForCorpus,
};
