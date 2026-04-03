let db;

function setDb(database) {
  db = database;
}

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
        WHERE so.transcript_id = t.id AND so.content IS NOT NULL AND so.content != ''
      ) + (
        CASE WHEN EXISTS(SELECT 1 FROM meaning_units mu WHERE mu.transcript_id = t.id) THEN 1 ELSE 0 END
      ) as completed_stages
    FROM transcripts t
    ORDER BY t.participant_id, t.workflow
  `).all();
}

function getTranscript(id) {
  return db.prepare('SELECT * FROM transcripts WHERE id = ?').get(id);
}

function importTranscript({ participantId, workflow, rawText }) {
  const result = db.prepare(
    'INSERT INTO transcripts (participant_id, workflow, raw_text) VALUES (?, ?, ?)'
  ).run(participantId, workflow, rawText);

  const transcriptId = result.lastInsertRowid;
  const insertStage = db.prepare(
    'INSERT OR IGNORE INTO stage_outputs (transcript_id, stage, content) VALUES (?, ?, ?)'
  );
  for (const stage of ['memo', 'themes', 'whole_part', 'essence']) {
    insertStage.run(transcriptId, stage, '');
  }

  return { id: transcriptId };
}

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

function saveStageOutput(transcriptId, stage, content) {
  db.prepare(`
    INSERT INTO stage_outputs (transcript_id, stage, content, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(transcript_id, stage) DO UPDATE SET
      content = excluded.content,
      updated_at = CURRENT_TIMESTAMP
  `).run(transcriptId, stage, content);
}

function getMeaningUnits(transcriptId) {
  return db.prepare(
    'SELECT * FROM meaning_units WHERE transcript_id = ? ORDER BY mu_order'
  ).all(transcriptId);
}

function addMeaningUnit(transcriptId, workflow) {
  const { max_order } = db.prepare(
    'SELECT COALESCE(MAX(mu_order), 0) as max_order FROM meaning_units WHERE transcript_id = ?'
  ).get(transcriptId);

  const result = db.prepare(
    'INSERT INTO meaning_units (transcript_id, workflow, mu_order) VALUES (?, ?, ?)'
  ).run(transcriptId, workflow, max_order + 1);

  return db.prepare('SELECT * FROM meaning_units WHERE id = ?').get(result.lastInsertRowid);
}

function saveMeaningUnit(mu) {
  db.prepare(`
    UPDATE meaning_units SET
      excerpt = ?,
      boundary_justification = ?,
      paraphrase = ?,
      analyst_note = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(mu.excerpt || null, mu.boundary_justification || null, mu.paraphrase || null, mu.analyst_note || null, mu.id);
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

function getAllStageOutputsForCorpus() {
  return db.prepare(`
    SELECT t.participant_id, t.workflow, so.stage, so.content, so.updated_at
    FROM stage_outputs so
    JOIN transcripts t ON t.id = so.transcript_id
    ORDER BY t.participant_id, t.workflow, so.stage
  `).all();
}

function getAllMeaningUnitsForCorpus() {
  return db.prepare(`
    SELECT t.participant_id, mu.workflow, mu.mu_order, mu.excerpt,
           mu.boundary_justification, mu.paraphrase, mu.analyst_note, mu.updated_at
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
  addMeaningUnit,
  saveMeaningUnit,
  deleteMeaningUnit,
  reorderMeaningUnits,
  getAllStageOutputsForCorpus,
  getAllMeaningUnitsForCorpus,
};
