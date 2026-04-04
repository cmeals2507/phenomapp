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
      (
        SELECT COUNT(DISTINCT so.stage)
        FROM stage_outputs so
        WHERE so.transcript_id = t.id
          AND so.stage IN ('memo', 'whole_part', 'essence')
          AND so.content IS NOT NULL AND so.content != ''
      ) +
      (
        CASE WHEN EXISTS(
          SELECT 1 FROM meaning_units mu WHERE mu.transcript_id = t.id
        ) THEN 1 ELSE 0 END
      ) +
      (
        CASE WHEN EXISTS(
          SELECT 1 FROM meaning_units mu2
          WHERE mu2.transcript_id = t.id
            AND mu2.provisional_theme IS NOT NULL
            AND mu2.provisional_theme != ''
        ) THEN 1 ELSE 0 END
      )
      AS completed_stages
    FROM transcripts t
    ORDER BY t.participant_id, t.workflow
  `).all();
}

function getTranscript(id) {
  return db.prepare('SELECT * FROM transcripts WHERE id = ?').get(id);
}

/**
 * Import a transcript.
 * Creates stage_outputs rows for memo, whole_part, essence only.
 * Stage 3 (provisional themes) lives entirely in meaning_units columns.
 */
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

/**
 * Upsert a stage output, including updated day_stamps.
 * day_stamps is computed by the IPC handler (timestamps.js) before calling here.
 */
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

/**
 * Add a new meaning unit row. day_stamps is initialized by the IPC handler.
 */
function addMeaningUnit(transcriptId, workflow, dayStamps) {
  const { max_order } = db.prepare(
    'SELECT COALESCE(MAX(mu_order), 0) as max_order FROM meaning_units WHERE transcript_id = ?'
  ).get(transcriptId);

  const result = db.prepare(
    'INSERT INTO meaning_units (transcript_id, workflow, mu_order, day_stamps) VALUES (?, ?, ?, ?)'
  ).run(transcriptId, workflow, max_order + 1, dayStamps);

  return db.prepare('SELECT * FROM meaning_units WHERE id = ?').get(result.lastInsertRowid);
}

/**
 * Update all analyst-editable fields on a meaning unit.
 * day_stamps is computed by the IPC handler (timestamps.js) before calling here.
 */
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
    mu.day_stamps || null,
    mu.id
  );
}

/**
 * Immediate color-only save. Does NOT update day_stamps (color = structural tag,
 * not analyst text entry — see SPEC_v2.md §16).
 */
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

/**
 * Returns only rows that have both excerpt and provisional_theme set —
 * the minimum data needed for the TranscriptPanel highlight layer.
 */
function getHighlightData(transcriptId) {
  return db.prepare(`
    SELECT id AS mu_id, mu_order, excerpt, provisional_theme, theme_color
    FROM meaning_units
    WHERE transcript_id = ?
      AND excerpt IS NOT NULL AND excerpt != ''
      AND provisional_theme IS NOT NULL AND provisional_theme != ''
    ORDER BY mu_order
  `).all(transcriptId);
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
      mu.provisional_theme, mu.theme_color, mu.stage3_notes,
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
  importTranscript,
  getStageOutput,
  getAllStageOutputs,
  saveStageOutput,
  getMeaningUnits,
  getMeaningUnitById,
  addMeaningUnit,
  saveMeaningUnit,
  saveMeaningUnitColor,
  deleteMeaningUnit,
  reorderMeaningUnits,
  getHighlightData,
  getAllStageOutputsForCorpus,
  getAllMeaningUnitsForCorpus,
};
