const { stringify } = require('csv-stringify/sync');

function formatSingleCase(transcript, stageOutputs, meaningUnits) {
  const stageMap = {};
  for (const so of stageOutputs) {
    stageMap[so.stage] = so.content || '';
  }

  const muText = meaningUnits.length === 0
    ? '(no meaning units)'
    : meaningUnits.map(mu => [
        `MU-${String(mu.mu_order).padStart(3, '0')}`,
        `  Excerpt: ${mu.excerpt || ''}`,
        `  Boundary Justification: ${mu.boundary_justification || ''}`,
        `  Paraphrase: ${mu.paraphrase || ''}`,
        `  Analyst Note: ${mu.analyst_note || ''}`,
      ].join('\n')).join('\n\n');

  return [
    'PHENOMAPP CASE EXPORT',
    '=====================',
    `Participant ID: ${transcript.participant_id}`,
    `Workflow: ${transcript.workflow}`,
    `Exported: ${new Date().toISOString()}`,
    '',
    '--- TRANSCRIPT ---',
    transcript.raw_text,
    '',
    '--- STAGE 1: HOLISTIC MEMO ---',
    stageMap['memo'] || '',
    '',
    '--- STAGE 2: MEANING UNITS ---',
    muText,
    '',
    '--- STAGE 3: PROVISIONAL THEMES ---',
    stageMap['themes'] || '',
    '',
    '--- STAGE 4: WHOLE-PART RECONCILIATION ---',
    stageMap['whole_part'] || '',
    '',
    '--- STAGE 5: INDIVIDUAL ESSENCE ---',
    stageMap['essence'] || '',
  ].join('\n');
}

function formatCorpusStageOutputs(rows) {
  return stringify(rows, {
    header: true,
    columns: ['participant_id', 'workflow', 'stage', 'content', 'updated_at'],
  });
}

function formatCorpusMeaningUnits(rows) {
  return stringify(rows, {
    header: true,
    columns: ['participant_id', 'workflow', 'mu_order', 'excerpt', 'boundary_justification', 'paraphrase', 'analyst_note', 'updated_at'],
  });
}

module.exports = { formatSingleCase, formatCorpusStageOutputs, formatCorpusMeaningUnits };
