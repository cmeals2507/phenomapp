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

// ---------------------------------------------------------------------------
// Corpus JSON export (structured for LLM use)
// ---------------------------------------------------------------------------

function parseDayStamps(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

function formatCorpusJson(transcripts, stageOutputs, meaningUnits, positionality, dbPath) {
  const dbFilename = dbPath ? dbPath.split('/').pop() : 'unknown';

  // Build lookup maps
  const stageMap = {};
  for (const so of stageOutputs) {
    stageMap[`${so.participant_id}/${so.workflow}/${so.stage}`] = so;
  }

  const muMap = {};
  for (const mu of meaningUnits) {
    const key = `${mu.participant_id}/${mu.workflow}`;
    if (!muMap[key]) muMap[key] = [];
    muMap[key].push(mu);
  }

  function getStageOutput(participantId, workflow, stage) {
    const s = stageMap[`${participantId}/${workflow}/${stage}`];
    if (!s) return null;
    return {
      content: s.content || '',
      day_stamps: parseDayStamps(s.day_stamps),
      updated_at: s.updated_at || null,
    };
  }

  const cases = transcripts.map(t => {
    const mus = muMap[`${t.participant_id}/${t.workflow}`] || [];

    const themeGroups = {};
    for (const mu of mus) {
      const theme = mu.provisional_theme && mu.provisional_theme.trim();
      if (theme) {
        if (!themeGroups[theme]) themeGroups[theme] = { color: mu.theme_color || null, meaning_unit_ids: [] };
        themeGroups[theme].meaning_unit_ids.push(`MU-${String(mu.mu_order).padStart(3, '0')}`);
      }
    }

    const taggedCount = mus.filter(mu => mu.provisional_theme && mu.provisional_theme.trim()).length;
    const memo = getStageOutput(t.participant_id, t.workflow, 'memo');
    const wholePart = getStageOutput(t.participant_id, t.workflow, 'whole_part');
    const essence = getStageOutput(t.participant_id, t.workflow, 'essence');

    return {
      participant_id: t.participant_id,
      workflow: t.workflow,
      imported_at: t.created_at || null,
      transcript: t.raw_text,
      analysis: {
        stage1_holistic_memo: memo,
        stage2_meaning_units: mus.map(mu => ({
          id: `MU-${String(mu.mu_order).padStart(3, '0')}`,
          mu_order: mu.mu_order,
          display_order: mu.display_order,
          excerpt: mu.excerpt || '',
          boundary_justification: mu.boundary_justification || '',
          paraphrase: mu.paraphrase || '',
          analyst_note: mu.analyst_note || '',
          provisional_theme: mu.provisional_theme || null,
          theme_color: mu.theme_color || null,
          thematic_interpretation: mu.thematic_interpretation || '',
          stage3_notes: mu.stage3_notes || '',
          day_stamps: parseDayStamps(mu.day_stamps),
          updated_at: mu.updated_at || null,
        })),
        stage3_themes: themeGroups,
        stage4_whole_part_reconciliation: wholePart,
        stage5_individual_essence: essence,
      },
      completion: {
        stage1_memo: !!(memo && memo.content),
        stage2_meaning_unit_count: mus.length,
        stage3_tagged_count: taggedCount,
        stage3_untagged_count: mus.length - taggedCount,
        stage3_theme_count: Object.keys(themeGroups).length,
        stage4_whole_part: !!(wholePart && wholePart.content),
        stage5_essence: !!(essence && essence.content),
      },
    };
  });

  // Cross-case theme index
  const crossCaseThemeIndex = {};
  for (const c of cases) {
    for (const [theme, data] of Object.entries(c.analysis.stage3_themes)) {
      if (!crossCaseThemeIndex[theme]) crossCaseThemeIndex[theme] = { cases: [], total_meaning_units: 0 };
      crossCaseThemeIndex[theme].cases.push(`${c.participant_id}/${c.workflow}`);
      crossCaseThemeIndex[theme].total_meaning_units += data.meaning_unit_ids.length;
    }
  }

  // Participant cross-workflow index
  const participantWorkflowIndex = {};
  for (const c of cases) {
    if (!participantWorkflowIndex[c.participant_id]) participantWorkflowIndex[c.participant_id] = [];
    participantWorkflowIndex[c.participant_id].push(c.workflow);
  }

  // Workflow summary
  const workflowSummary = {};
  for (const c of cases) {
    if (!workflowSummary[c.workflow]) workflowSummary[c.workflow] = { case_count: 0, total_meaning_units: 0, completed_cases: 0 };
    const ws = workflowSummary[c.workflow];
    ws.case_count++;
    ws.total_meaning_units += c.completion.stage2_meaning_unit_count;
    if (c.completion.stage1_memo && c.completion.stage2_meaning_unit_count > 0 && c.completion.stage4_whole_part && c.completion.stage5_essence) {
      ws.completed_cases++;
    }
  }

  const output = {
    meta: {
      exported_at: new Date().toISOString(),
      project_database: dbFilename,
      export_format_version: '1.0',
      total_cases: cases.length,
      methodology: 'Hermeneutic phenomenological analysis',
      methodology_notes: "This corpus was analyzed using a five-stage hermeneutic phenomenological approach. Stage 1 (Holistic Memo) captures the analyst's initial impressions of the whole transcript. Stage 2 (Meaning Units) identifies discrete segments of experiential significance. Stage 3 (Provisional Themes) groups meaning units into thematic categories. Stage 4 (Whole-Part Reconciliation) revisits the whole transcript in light of the parts. Stage 5 (Individual Essence) synthesizes a phenomenological description of the participant's lived experience.",
      workflow_types: {
        human: 'Analysis conducted entirely by a human analyst',
        hybrid: 'Analysis conducted collaboratively by a human analyst and an LLM',
        machine: 'Analysis conducted entirely by an LLM',
      },
      stage_descriptions: {
        stage1_holistic_memo: "The analyst's initial holistic response after reading the full transcript — impressions, felt sense, and pre-thematic observations.",
        stage2_meaning_units: "Discrete text segments extracted from the transcript that carry experiential significance. Each unit includes the verbatim excerpt, a boundary justification, a paraphrase in phenomenological language, and an optional analyst note. mu_order is the immutable canonical ID; display_order reflects the analyst's final arrangement.",
        stage3_themes: "Provisional thematic groupings assigned to meaning units. Each unit receives a theme label, color code, thematic interpretation (the experiential insight the unit reveals), and optional notes. stage3_themes provides a summary map of theme → meaning unit IDs for this case.",
        stage4_whole_part_reconciliation: "A return to the whole transcript after stages 2–3 to check for coherence between the identified parts (meaning units, themes) and the whole. New meaning units may be added; themes may be revised.",
        stage5_individual_essence: "A narrative synthesis of the essential structure of this participant's lived experience of the phenomenon under study.",
      },
    },
    positionality: positionality ? {
      text: positionality.text || '',
      created_at: positionality.created_at || null,
      updated_at: positionality.updated_at || null,
    } : null,
    participant_workflow_index: participantWorkflowIndex,
    workflow_summary: workflowSummary,
    cross_case_theme_index: crossCaseThemeIndex,
    corpus: cases,
  };

  return JSON.stringify(output, null, 2);
}

module.exports = {
  formatSingleCase,
  formatCorpusStageOutputs,
  formatCorpusMeaningUnits,
  formatCorpusReorderLog,
  formatPositionality,
  formatCorpusJson,
};
