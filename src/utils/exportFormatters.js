'use strict';

const { stringify } = require('csv-stringify/sync');

// ---------------------------------------------------------------------------
// Single-case .txt export
// ---------------------------------------------------------------------------

function formatDayStamps(dayStampsJson) {
  try {
    const stamps = JSON.parse(dayStampsJson || '[]');
    if (!Array.isArray(stamps) || stamps.length === 0) return '';
    return '[Day stamps: ' + stamps.map(s => `${s.date} (first edited ${s.first_edited_at})`).join(', ') + ']';
  } catch {
    return '';
  }
}

function formatMeaningUnit(mu) {
  const id = `MU-${String(mu.mu_order).padStart(3, '0')}`;
  const lines = [
    id,
    `  Excerpt: ${mu.excerpt || ''}`,
    `  Boundary Justification: ${mu.boundary_justification || ''}`,
    `  Paraphrase: ${mu.paraphrase || ''}`,
    `  Analyst Note: ${mu.analyst_note || ''}`,
  ];
  const ds = formatDayStamps(mu.day_stamps);
  if (ds) lines.push(`  ${ds}`);
  return lines.join('\n');
}

/**
 * Build Stage 3 section: meaning units grouped by provisional_theme.
 */
function formatStage3Section(meaningUnits) {
  const tagged = meaningUnits.filter(mu => mu.provisional_theme && mu.provisional_theme.trim());
  const untagged = meaningUnits.filter(mu => !mu.provisional_theme || !mu.provisional_theme.trim());

  if (tagged.length === 0 && untagged.length === 0) {
    return '(no meaning units)';
  }

  const groups = new Map();
  for (const mu of tagged) {
    const key = mu.provisional_theme;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(mu);
  }

  const lines = ['Themes identified:'];
  for (const [label, units] of groups) {
    const color = units[0]?.theme_color || '';
    lines.push(`  ${color ? `[${color}] ` : ''}${label}`);
    for (const mu of units) {
      const id = `MU-${String(mu.mu_order).padStart(3, '0')}`;
      lines.push(`    ${id}  Paraphrase: ${mu.paraphrase || ''}  |  Thematic Interpretation: ${mu.thematic_interpretation || ''}  |  Stage 3 Notes: ${mu.stage3_notes || ''}`);
    }
  }

  if (untagged.length > 0) {
    lines.push('');
    lines.push('Untagged units:');
    for (const mu of untagged) {
      const id = `MU-${String(mu.mu_order).padStart(3, '0')}`;
      lines.push(`    ${id}  Paraphrase: ${mu.paraphrase || ''}  |  Stage 3 Notes: ${mu.stage3_notes || ''}`);
    }
  }

  return lines.join('\n');
}

function formatSingleCase(transcript, stageOutputs, meaningUnits) {
  const stageMap = {};
  for (const so of stageOutputs) {
    stageMap[so.stage] = { content: so.content || '', day_stamps: so.day_stamps };
  }

  const muText = meaningUnits.length === 0
    ? '(no meaning units)'
    : meaningUnits.map(formatMeaningUnit).join('\n\n');

  function stageBlock(key) {
    const s = stageMap[key];
    if (!s) return '';
    const ds = formatDayStamps(s.day_stamps);
    return [s.content || '', ds].filter(Boolean).join('\n');
  }

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
    stageBlock('memo'),
    '',
    '--- STAGE 2: MEANING UNITS ---',
    muText,
    '',
    '--- STAGE 3: PROVISIONAL THEMES ---',
    formatStage3Section(meaningUnits),
    '',
    '--- STAGE 4: WHOLE-PART RECONCILIATION ---',
    stageBlock('whole_part'),
    '',
    '--- STAGE 5: INDIVIDUAL ESSENCE ---',
    stageBlock('essence'),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Corpus CSV exports
// ---------------------------------------------------------------------------

function formatCorpusStageOutputs(rows) {
  return stringify(rows, {
    header: true,
    columns: ['participant_id', 'workflow', 'stage', 'content', 'day_stamps', 'updated_at'],
  });
}

function formatCorpusMeaningUnits(rows) {
  return stringify(rows, {
    header: true,
    columns: [
      'participant_id', 'workflow', 'mu_order', 'display_order',
      'excerpt', 'boundary_justification', 'paraphrase', 'analyst_note',
      'provisional_theme', 'theme_color', 'thematic_interpretation', 'stage3_notes',
      'day_stamps', 'updated_at',
    ],
  });
}

function formatCorpusReorderLog(rows) {
  return stringify(rows, {
    header: true,
    columns: ['id', 'transcript_id', 'reordered_at', 'order_snapshot', 'note'],
  });
}

// ---------------------------------------------------------------------------
// Positionality .txt export
// ---------------------------------------------------------------------------

function formatPositionality(positionality, dbPath) {
  const dbFilename = dbPath ? dbPath.split('/').pop() : 'unknown';
  return [
    'ANALYST POSITIONALITY STATEMENT',
    `Project database: ${dbFilename}`,
    `Created: ${positionality.created_at || '(not recorded)'}`,
    `Last edited: ${positionality.updated_at || '(not recorded)'}`,
    '',
    positionality.text || '(no positionality record entered)',
  ].join('\n');
}

module.exports = {
  formatSingleCase,
  formatCorpusStageOutputs,
  formatCorpusMeaningUnits,
  formatCorpusReorderLog,
  formatPositionality,
};
