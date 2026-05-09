import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';

function formatMUId(order) {
  return `MU-${String(order).padStart(3, '0')}`;
}

function splitIntoSegments(text, ranges) {
  const boundarySet = new Set([0, text.length]);
  for (const r of ranges) {
    if (r.start >= 0 && r.start < text.length) boundarySet.add(r.start);
    if (r.end > 0 && r.end <= text.length) boundarySet.add(r.end);
  }
  const boundaries = [...boundarySet].sort((a, b) => a - b);
  return boundaries.slice(0, -1).map((start, i) => {
    const end = boundaries[i + 1];
    const active = ranges.filter(r => r.start <= start && r.end >= end);
    return { text: text.slice(start, end), start, end, active };
  });
}

function getAbsoluteOffset(containerEl, node, offset) {
  const walker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT);
  let total = 0;
  while (walker.nextNode()) {
    const cur = walker.currentNode;
    if (cur === node) return total + offset;
    total += cur.length;
  }
  return total;
}

// Minimal theme autocomplete used in Stage 3 panel
function ThemeInput({ value, suggestions, onChange, onSelect }) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef(null);

  const filtered = useMemo(() => {
    if (!value.trim()) return suggestions;
    const q = value.toLowerCase();
    return suggestions.filter(s => s.label.toLowerCase().includes(q) && s.label !== value);
  }, [value, suggestions]);

  useEffect(() => { setActiveIdx(-1); }, [filtered]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (open && activeIdx >= 0 && filtered.length > 0) {
        const s = filtered[activeIdx];
        onSelect(s.label, s.color);
        setOpen(false);
      }
      return;
    }
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <textarea
        value={value}
        ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
        onChange={e => {
          e.target.style.height = 'auto';
          e.target.style.height = e.target.scrollHeight + 'px';
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Enter theme…"
        rows={1}
        className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none leading-relaxed bg-white"
        style={{ overflow: 'hidden', minHeight: '2rem' }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 z-50 bg-white border border-gray-200 rounded shadow-lg min-w-[200px] max-h-40 overflow-y-auto">
          {filtered.map((s, idx) => (
            <button
              key={s.label}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onSelect(s.label, s.color); setOpen(false); }}
              className={`flex items-center gap-2 w-full text-left px-3 py-1.5 text-xs ${
                idx === activeIdx ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <span
                className="inline-block w-3 h-3 rounded-full border border-gray-300 shrink-0"
                style={{ backgroundColor: s.color || '#d1d5db' }}
              />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AutoTextarea({ value, onChange, placeholder, minHeight = '3rem' }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => {
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
        onChange(e.target.value);
      }}
      placeholder={placeholder}
      className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 resize-none leading-relaxed bg-white"
      style={{ overflow: 'hidden', minHeight }}
    />
  );
}

// Props:
//   transcriptId, muId, muOrder, unit (full MU object), stage ('stage2' | 'stage3')
//   onClose, onLinksChanged, onCellChange, onColorChange, suggestions (for stage3 theme autocomplete)
export default function MemoLinkModal({
  transcriptId, muId, muOrder, unit, stage,
  onClose, onLinksChanged, onCellChange, onColorChange, suggestions = [],
}) {
  const [memoContent, setMemoContent] = useState('');
  const [thisLinks, setThisLinks] = useState([]);
  const [otherLinks, setOtherLinks] = useState([]);
  const [pendingSelection, setPendingSelection] = useState(null);
  const memoRef = useRef(null);

  // Memo search
  const [memoSearch, setMemoSearch] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);

  // Local field state — initialized once from unit prop; parent is notified via onCellChange
  const [fields, setFields] = useState(() => ({
    boundary_justification: unit?.boundary_justification || '',
    paraphrase: unit?.paraphrase || '',
    analyst_note: unit?.analyst_note || '',
    provisional_theme: unit?.provisional_theme || '',
    thematic_interpretation: unit?.thematic_interpretation || '',
  }));

  const loadLinks = useCallback(async () => {
    const allLinks = await window.phenomAPI.getMemoLinks(transcriptId);
    setThisLinks(allLinks.filter(l => l.mu_id === muId));
    setOtherLinks(allLinks.filter(l => l.mu_id !== muId));
  }, [transcriptId, muId]);

  useEffect(() => {
    async function load() {
      const [memo] = await Promise.all([
        window.phenomAPI.getStageOutput({ transcriptId, stage: 'memo' }),
        loadLinks(),
      ]);
      setMemoContent(memo?.content || '');
    }
    load();
  }, [transcriptId, loadLinks]);

  const handleFieldChange = useCallback((field, value) => {
    setFields(f => ({ ...f, [field]: value }));
    onCellChange?.(unit.id, field, value);
  }, [unit?.id, onCellChange]);

  const handleMouseUp = useCallback(() => {
    if (stage !== 'stage2') return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !memoRef.current) { setPendingSelection(null); return; }
    const range = sel.getRangeAt(0);
    if (!memoRef.current.contains(range.commonAncestorContainer)) { setPendingSelection(null); return; }
    const start = getAbsoluteOffset(memoRef.current, range.startContainer, range.startOffset);
    const end = getAbsoluteOffset(memoRef.current, range.endContainer, range.endOffset);
    if (start >= end) { setPendingSelection(null); return; }
    setPendingSelection({ start, end, text: memoContent.slice(start, end) });
  }, [stage, memoContent]);

  const handleLink = useCallback(async () => {
    if (!pendingSelection) return;
    await window.phenomAPI.addMemoLink({
      transcriptId, muId,
      memoStart: pendingSelection.start,
      memoEnd: pendingSelection.end,
      memoExcerpt: pendingSelection.text,
    });
    await loadLinks();
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
    onLinksChanged?.();
    window.dispatchEvent(new CustomEvent('phenomapp:memo-links-changed'));
    window.dispatchEvent(new CustomEvent('phenomapp:coverage-changed'));
  }, [pendingSelection, transcriptId, muId, loadLinks, onLinksChanged]);

  const handleDeleteLink = useCallback(async (linkId) => {
    await window.phenomAPI.deleteMemoLink(linkId);
    await loadLinks();
    onLinksChanged?.();
    window.dispatchEvent(new CustomEvent('phenomapp:memo-links-changed'));
    window.dispatchEvent(new CustomEvent('phenomapp:coverage-changed'));
  }, [loadLinks, onLinksChanged]);

  // Compute search match ranges
  const matchRanges = useMemo(() => {
    if (!memoSearch.trim() || !memoContent) return [];
    const q = memoSearch.toLowerCase();
    const text = memoContent.toLowerCase();
    const result = [];
    let pos = 0;
    while (pos < text.length) {
      const idx = text.indexOf(q, pos);
      if (idx === -1) break;
      result.push({ start: idx, end: idx + q.length, type: 'match', matchIdx: result.length });
      pos = idx + 1;
    }
    return result;
  }, [memoSearch, memoContent]);

  // Clamp matchIndex when result set changes
  useEffect(() => {
    setMatchIndex(i => matchRanges.length === 0 ? 0 : Math.min(i, matchRanges.length - 1));
  }, [matchRanges.length]);

  // Scroll current match into view
  useEffect(() => {
    if (!memoRef.current || matchRanges.length === 0) return;
    const el = memoRef.current.querySelector(`[data-match="${matchIndex}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [matchIndex, matchRanges.length]);

  const renderedMemo = useMemo(() => {
    if (!memoContent) return null;
    const ranges = [
      ...thisLinks.map(l => ({ start: l.memo_start, end: l.memo_end, type: 'this' })),
      ...otherLinks.map(l => ({ start: l.memo_start, end: l.memo_end, type: 'other', muOrder: l.mu_order })),
      ...(pendingSelection ? [{ start: pendingSelection.start, end: pendingSelection.end, type: 'pending' }] : []),
      ...matchRanges,
    ];
    if (ranges.length === 0) return <span>{memoContent}</span>;
    const segments = splitIntoSegments(memoContent, ranges);
    return segments.map((seg, i) => {
      const hasPending = seg.active.some(r => r.type === 'pending');
      const hasThis = seg.active.some(r => r.type === 'this');
      const hasOther = seg.active.some(r => r.type === 'other');
      const currentMatch = seg.active.find(r => r.type === 'match' && r.matchIdx === matchIndex);
      const anyMatch = seg.active.find(r => r.type === 'match');
      let bg = '';
      let title = '';
      // Search matches overlay other highlights when searching
      if (currentMatch) bg = '#fde047';       // yellow-300 — current match
      else if (anyMatch) bg = '#fef9c3';      // yellow-50 — other matches
      else if (hasPending) bg = '#bfdbfe';
      else if (hasThis) bg = '#fed7aa';
      else if (hasOther) {
        bg = '#f3f4f6';
        const muOrders = [...new Set(seg.active.filter(r => r.type === 'other').map(r => r.muOrder))];
        title = muOrders.map(formatMUId).join(', ');
      }
      return (
        <span
          key={i}
          style={bg ? { backgroundColor: bg } : undefined}
          title={title || undefined}
          data-match={currentMatch ? currentMatch.matchIdx : anyMatch ? anyMatch.matchIdx : undefined}
        >
          {seg.text}
        </span>
      );
    });
  }, [memoContent, thisLinks, otherLinks, pendingSelection, matchRanges, matchIndex]);

  const hasMemo = memoContent.trim().length > 0;
  const muLabel = formatMUId(muOrder);

  const isEarned = stage === 'stage2'
    ? thisLinks.length > 0
    : Boolean(fields.provisional_theme?.trim() && fields.thematic_interpretation?.trim());

  const earnedRequirement = stage === 'stage2'
    ? 'Link at least one memo passage to earn the transcript highlight'
    : 'Fill Provisional Theme + Thematic Interpretation to earn the theme highlight';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl flex flex-col border border-gray-200 overflow-hidden"
        style={{ width: 'min(920px, 94vw)', height: '87vh' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="font-mono text-sm font-semibold text-gray-700 shrink-0">{muLabel}</span>
            <span
              className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                isEarned ? 'bg-green-100 text-green-700' : 'bg-orange-50 text-orange-600'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isEarned ? 'bg-green-500' : 'bg-orange-400'}`} />
              {isEarned ? 'Highlight earned' : 'Highlight not yet earned'}
            </span>
            {!isEarned && (
              <span className="text-xs text-gray-400 truncate">{earnedRequirement}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-4 shrink-0"
          >✕</button>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* LEFT: MU context + focal fields */}
          <div
            className="flex flex-col overflow-y-auto border-r border-gray-100 shrink-0 p-4 space-y-4"
            style={{ width: 360 }}
          >
            {/* Transcript excerpt */}
            {unit?.excerpt && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Transcript excerpt</p>
                <blockquote className="text-xs text-gray-700 leading-relaxed border-l-2 border-indigo-300 pl-3 bg-indigo-50 py-2 pr-2 rounded-r italic">
                  &ldquo;{unit.excerpt}&rdquo;
                </blockquote>
              </div>
            )}

            {/* ── Stage 2 fields ── */}
            {stage === 'stage2' && (
              <>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Boundary Justification</p>
                  <AutoTextarea
                    value={fields.boundary_justification}
                    onChange={v => handleFieldChange('boundary_justification', v)}
                    placeholder="Why does this unit begin and end where it does?"
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Paraphrase</p>
                  <AutoTextarea
                    value={fields.paraphrase}
                    onChange={v => handleFieldChange('paraphrase', v)}
                    placeholder="Restate in phenomenological language…"
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Analyst Note</p>
                  <AutoTextarea
                    value={fields.analyst_note}
                    onChange={v => handleFieldChange('analyst_note', v)}
                    placeholder="Observations, hunches, open questions…"
                  />
                </div>
              </>
            )}

            {/* ── Stage 3 fields ── */}
            {stage === 'stage3' && (
              <>
                {unit?.boundary_justification && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-1">Boundary Justification <span className="font-normal italic">(Stage 2)</span></p>
                    <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 px-2 py-1.5 rounded border border-gray-100">
                      {unit.boundary_justification}
                    </p>
                  </div>
                )}
                {unit?.paraphrase && (
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-1">Paraphrase <span className="font-normal italic">(Stage 2)</span></p>
                    <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 px-2 py-1.5 rounded border border-gray-100">
                      {unit.paraphrase}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    Provisional Theme
                    {!isEarned && <span className="ml-1.5 text-orange-400 font-normal">required</span>}
                  </p>
                  <ThemeInput
                    value={fields.provisional_theme}
                    suggestions={suggestions}
                    onChange={v => handleFieldChange('provisional_theme', v)}
                    onSelect={(label, color) => {
                      handleFieldChange('provisional_theme', label);
                      if (color) onColorChange?.(unit.id, color);
                    }}
                  />
                </div>

                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    Thematic Interpretation
                    {!isEarned && <span className="ml-1.5 text-orange-400 font-normal">required</span>}
                  </p>
                  <AutoTextarea
                    value={fields.thematic_interpretation}
                    onChange={v => handleFieldChange('thematic_interpretation', v)}
                    placeholder="What structural feature of the lived experience does this theme describe — and how does this meaning unit illuminate it?"
                    minHeight="4rem"
                  />
                </div>
              </>
            )}
          </div>

          {/* RIGHT: Holistic Memo */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

            {/* Memo sub-header */}
            <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 shrink-0 flex items-center gap-3 flex-wrap">
              <span className="text-xs font-medium text-gray-600 shrink-0">Holistic Memo</span>

              {/* Search input */}
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-1 border border-gray-200 rounded px-1.5 bg-white">
                  <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                  </svg>
                  <input
                    type="text"
                    value={memoSearch}
                    onChange={e => { setMemoSearch(e.target.value); setMatchIndex(0); }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') setMatchIndex(i => matchRanges.length ? (i + 1) % matchRanges.length : 0);
                      if (e.key === 'Escape') { setMemoSearch(''); setMatchIndex(0); }
                    }}
                    placeholder="Search memo…"
                    className="text-xs py-0.5 focus:outline-none bg-transparent w-28"
                  />
                </div>
                {memoSearch && (
                  <span className="text-xs text-gray-400 shrink-0">
                    {matchRanges.length === 0 ? 'No matches' : `${matchIndex + 1} / ${matchRanges.length}`}
                  </span>
                )}
                {matchRanges.length > 1 && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={() => setMatchIndex(i => (i - 1 + matchRanges.length) % matchRanges.length)}
                      className="text-gray-400 hover:text-gray-600 px-1 py-0.5 rounded hover:bg-gray-200 text-xs leading-none"
                      title="Previous match"
                    >↑</button>
                    <button
                      onClick={() => setMatchIndex(i => (i + 1) % matchRanges.length)}
                      className="text-gray-400 hover:text-gray-600 px-1 py-0.5 rounded hover:bg-gray-200 text-xs leading-none"
                      title="Next match"
                    >↓</button>
                  </div>
                )}
                {memoSearch && (
                  <button
                    onClick={() => { setMemoSearch(''); setMatchIndex(0); }}
                    className="text-gray-300 hover:text-gray-500 text-xs leading-none shrink-0"
                    title="Clear search"
                  >✕</button>
                )}
              </div>

              {/* Highlight legend */}
              <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
                {(thisLinks.length > 0 || stage === 'stage2') && (
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-orange-200" />
                    This MU
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm bg-gray-100 border border-gray-300" />
                  Other MU
                </span>
                {stage === 'stage2' && pendingSelection && (
                  <span className="text-blue-600 font-medium flex items-center gap-1">
                    <span className="inline-block w-3 h-3 rounded-sm bg-blue-200" />
                    Selection ready — {pendingSelection.end - pendingSelection.start} chars
                  </span>
                )}
              </div>
            </div>

            {/* Stage 2: linked passages summary */}
            {stage === 'stage2' && thisLinks.length > 0 && (
              <div className="px-4 py-2 border-b border-gray-100 bg-amber-50 shrink-0">
                <p className="text-xs font-medium text-amber-700 mb-1.5">
                  {thisLinks.length} linked passage{thisLinks.length !== 1 ? 's' : ''} — highlight active
                </p>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {thisLinks.map(link => (
                    <div key={link.id} className="flex items-start gap-2 text-xs bg-white rounded border border-amber-100 px-2 py-1">
                      <span className="flex-1 text-gray-700 italic leading-snug">&ldquo;{link.memo_excerpt}&rdquo;</span>
                      <button
                        onClick={() => handleDeleteLink(link.id)}
                        className="text-gray-300 hover:text-red-500 shrink-0 text-sm leading-none"
                        title="Remove link"
                      >✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stage 3: linked passage context */}
            {stage === 'stage3' && thisLinks.length > 0 && (
              <div className="px-4 py-2 border-b border-gray-100 bg-amber-50 shrink-0">
                <p className="text-xs font-medium text-amber-700 mb-1.5">
                  Memo passages linked in Stage 2 ({thisLinks.length})
                </p>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {thisLinks.map(link => (
                    <div key={link.id} className="text-xs bg-white rounded border border-amber-100 px-2 py-1">
                      <span className="text-gray-700 italic leading-snug">&ldquo;{link.memo_excerpt}&rdquo;</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Memo body */}
            {!hasMemo ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <p className="text-sm text-gray-400 text-center">
                  No holistic memo yet. Complete Stage 1 before linking passages here.
                </p>
              </div>
            ) : (
              <div
                ref={memoRef}
                onMouseUp={handleMouseUp}
                className={`flex-1 overflow-y-auto p-5 ${stage === 'stage2' ? 'select-text cursor-text' : 'select-auto'}`}
              >
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {renderedMemo}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
          <p className="text-xs text-gray-400">
            {stage === 'stage2' && hasMemo && !pendingSelection && 'Click and drag in the memo to select a passage to link'}
            {stage === 'stage2' && hasMemo && pendingSelection && `"${pendingSelection.text.length > 72 ? pendingSelection.text.slice(0, 72) + '…' : pendingSelection.text}"`}
            {stage === 'stage3' && 'Memo shown for reference — Stage 2 linked passages highlighted in orange'}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            {stage === 'stage2' && pendingSelection && (
              <button
                onClick={handleLink}
                className="text-xs px-3 py-1.5 bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors"
              >
                Link this passage
              </button>
            )}
            <button
              onClick={onClose}
              className="text-xs px-4 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
