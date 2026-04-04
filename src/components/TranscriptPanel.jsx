import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { findExcerptInText } from '../utils/fuzzyMatch';

const WORKFLOW_LABELS = {
  human:   'Human-Only',
  hybrid:  'Human-Machine Hybrid',
  machine: 'Machine-Only',
};

// ---------------------------------------------------------------------------
// Text segmentation helpers
// ---------------------------------------------------------------------------

/**
 * Split `text` into segments based on a sorted list of non-overlapping ranges.
 * Each segment carries which ranges it belongs to.
 */
function splitByRanges(text, ranges) {
  // Collect all boundary positions.
  const boundarySet = new Set([0, text.length]);
  for (const r of ranges) {
    if (r.start >= 0 && r.start < text.length) boundarySet.add(r.start);
    if (r.end > 0 && r.end <= text.length) boundarySet.add(r.end);
  }

  const boundaries = [...boundarySet].sort((a, b) => a - b);
  const segments = [];

  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    const activeRanges = ranges.filter(r => r.start <= start && r.end >= end);
    segments.push({ text: text.slice(start, end), start, end, ranges: activeRanges });
  }

  return segments;
}

/** Convert a 6-char hex color to rgba string with given opacity. */
function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---------------------------------------------------------------------------
// Search helpers
// ---------------------------------------------------------------------------

function findSearchMatches(text, query) {
  if (!query || !query.trim()) return [];
  const matches = [];
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let idx = 0;
  while (idx < lower.length) {
    const pos = lower.indexOf(q, idx);
    if (pos === -1) break;
    matches.push({ start: pos, end: pos + q.length });
    idx = pos + 1;
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TranscriptPanel({ transcript, width, onExport }) {
  const wordCount = useMemo(() => {
    if (!transcript.raw_text) return 0;
    return transcript.raw_text.trim().split(/\s+/).filter(Boolean).length;
  }, [transcript.raw_text]);

  // --- Search state ---
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  // --- Theme highlight state ---
  const [highlightRanges, setHighlightRanges] = useState([]); // [{start, end, themeColor, themeLabel, muOrder}]
  const [showHighlights, setShowHighlights] = useState(true);

  const bodyRef = useRef(null);

  // Reset search when case changes.
  useEffect(() => {
    setSearchQuery('');
    setActiveMatchIndex(0);
  }, [transcript.id]);

  // ---------------------------------------------------------------------------
  // Theme highlight computation
  // ---------------------------------------------------------------------------

  const computeHighlights = useCallback(async () => {
    const data = await window.phenomAPI.getHighlightData(transcript.id);
    if (!data || data.length === 0) {
      setHighlightRanges([]);
      return;
    }

    const ranges = [];
    for (const item of data) {
      const match = findExcerptInText(item.excerpt, transcript.raw_text);
      if (match) {
        ranges.push({
          start: match.start,
          end: match.end,
          themeColor: item.theme_color || '#6366f1',
          themeLabel: item.provisional_theme,
          muOrder: item.mu_order,
        });
      }
    }

    setHighlightRanges(ranges);
  }, [transcript.id, transcript.raw_text]);

  // Compute on mount and when case changes.
  useEffect(() => {
    computeHighlights();
  }, [computeHighlights]);

  // Re-compute when Stage 3 saves new theme data.
  useEffect(() => {
    const handler = () => computeHighlights();
    window.addEventListener('phenomapp:highlights-changed', handler);
    return () => window.removeEventListener('phenomapp:highlights-changed', handler);
  }, [computeHighlights]);

  // ---------------------------------------------------------------------------
  // Search matches
  // ---------------------------------------------------------------------------

  const searchMatches = useMemo(
    () => findSearchMatches(transcript.raw_text, searchQuery),
    [transcript.raw_text, searchQuery]
  );

  const matchCount = searchMatches.length;

  // Clamp activeMatchIndex when match count changes.
  useEffect(() => {
    if (matchCount === 0) {
      setActiveMatchIndex(0);
    } else if (activeMatchIndex >= matchCount) {
      setActiveMatchIndex(matchCount - 1);
    }
  }, [matchCount, activeMatchIndex]);

  // Scroll active match into view.
  useEffect(() => {
    if (matchCount === 0 || !bodyRef.current) return;
    const el = bodyRef.current.querySelector(`[data-search-match="${activeMatchIndex}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeMatchIndex, matchCount]);

  const handleSearchPrev = () => {
    if (matchCount === 0) return;
    setActiveMatchIndex(i => (i - 1 + matchCount) % matchCount);
  };

  const handleSearchNext = () => {
    if (matchCount === 0) return;
    setActiveMatchIndex(i => (i + 1) % matchCount);
  };

  // ---------------------------------------------------------------------------
  // Annotated text rendering
  // ---------------------------------------------------------------------------

  const renderedText = useMemo(() => {
    const text = transcript.raw_text;
    if (!text) return null;

    // Build combined range list.
    const allRanges = [];

    if (showHighlights) {
      for (const hr of highlightRanges) {
        allRanges.push({ ...hr, type: 'theme' });
      }
    }

    searchMatches.forEach((m, idx) => {
      allRanges.push({ ...m, type: 'search', matchIndex: idx });
    });

    if (allRanges.length === 0) {
      return <span>{text}</span>;
    }

    const segments = splitByRanges(text, allRanges);

    // Track which matchIndex has already had its first segment marked (for scroll target).
    const firstMatchRendered = new Set();

    return segments.map((seg, i) => {
      const themeRanges = seg.ranges
        .filter(r => r.type === 'theme')
        .sort((a, b) => a.muOrder - b.muOrder);
      const searchRange = seg.ranges.find(r => r.type === 'search');

      let style = {};
      let title = '';
      let extraContent = null;

      // Apply theme highlight (lower mu_order wins on overlap).
      if (themeRanges.length === 1) {
        style.backgroundColor = hexToRgba(themeRanges[0].themeColor, 0.30);
        title = themeRanges[0].themeLabel;
      } else if (themeRanges.length >= 2) {
        style.backgroundColor = hexToRgba(themeRanges[0].themeColor, 0.30);
        title = themeRanges.map(t => t.themeLabel).join(' / ');
        // Overlay: small colored dot for second theme.
        extraContent = (
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: themeRanges[1].themeColor,
              verticalAlign: 'super',
              marginLeft: 2,
            }}
          />
        );
      }

      // Apply search highlight (overrides theme background color).
      if (searchRange) {
        style.backgroundColor = searchRange.matchIndex === activeMatchIndex
          ? '#fb923c' // orange — active
          : '#fde047'; // yellow — passive
      }

      // Attach scroll target to the first segment of each search match.
      const isFirstOfMatch = searchRange && !firstMatchRendered.has(searchRange.matchIndex);
      if (isFirstOfMatch) firstMatchRendered.add(searchRange.matchIndex);

      return (
        <span
          key={i}
          style={style}
          title={title || undefined}
          data-search-match={isFirstOfMatch ? searchRange.matchIndex : undefined}
        >
          {seg.text}
          {extraContent}
        </span>
      );
    });
  }, [transcript.raw_text, highlightRanges, showHighlights, searchMatches, activeMatchIndex]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className="flex flex-col border-r border-gray-200 bg-white shrink-0"
      style={{ width: width ?? 380, minWidth: 200 }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-semibold text-gray-800 text-sm">{transcript.participant_id}</h2>
          <p className="text-xs text-gray-500">
            {WORKFLOW_LABELS[transcript.workflow] || transcript.workflow}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowHighlights(v => !v)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              showHighlights
                ? 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100'
                : 'border-gray-200 text-gray-500 hover:bg-gray-100'
            }`}
          >
            {showHighlights ? 'Hide highlights' : 'Show highlights'}
          </button>
          <button
            onClick={onExport}
            className="text-xs px-2 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded border border-gray-200"
          >
            Export
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 shrink-0 flex items-center gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setActiveMatchIndex(0); }}
          placeholder="Search transcript..."
          className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
        />
        {searchQuery && (
          <>
            <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
              {matchCount === 0 ? '0 matches' : `${activeMatchIndex + 1} of ${matchCount}`}
            </span>
            <button
              onClick={handleSearchPrev}
              disabled={matchCount === 0}
              className="text-xs px-1.5 py-1 border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-30"
              title="Previous match"
            >
              ↑
            </button>
            <button
              onClick={handleSearchNext}
              disabled={matchCount === 0}
              className="text-xs px-1.5 py-1 border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-30"
              title="Next match"
            >
              ↓
            </button>
            <button
              onClick={() => { setSearchQuery(''); setActiveMatchIndex(0); }}
              className="text-xs px-1.5 py-1 border border-gray-200 rounded hover:bg-gray-100 text-gray-400"
              title="Clear search"
            >
              ✕
            </button>
          </>
        )}
      </div>

      {/* Transcript body */}
      <div ref={bodyRef} className="flex-1 overflow-y-auto p-4 min-h-0">
        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
          {renderedText}
        </pre>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-200 shrink-0 flex items-center gap-3">
        <p className="text-xs text-gray-400">{wordCount.toLocaleString()} words</p>
        {searchQuery && matchCount > 0 && (
          <p className="text-xs text-gray-400">{matchCount} match{matchCount !== 1 ? 'es' : ''}</p>
        )}
      </div>
    </div>
  );
}
