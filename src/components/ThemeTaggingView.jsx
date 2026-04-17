import React, { useState, useRef, useEffect, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Color palette — 10 hue families × 8 lightness steps
// Each sub-array is one column (hue), ordered light → dark.
// ---------------------------------------------------------------------------
const PALETTE = [
  ['#fee2e2','#fecaca','#fca5a5','#f87171','#ef4444','#dc2626','#b91c1c','#991b1b'], // Red
  ['#ffedd5','#fed7aa','#fdba74','#fb923c','#f97316','#ea580c','#c2410c','#9a3412'], // Orange
  ['#fef9c3','#fef08a','#fde047','#facc15','#eab308','#ca8a04','#a16207','#854d0e'], // Yellow
  ['#dcfce7','#bbf7d0','#86efac','#4ade80','#22c55e','#16a34a','#15803d','#166534'], // Green
  ['#ccfbf1','#99f6e4','#5eead4','#2dd4bf','#14b8a6','#0d9488','#0f766e','#115e59'], // Teal
  ['#dbeafe','#bfdbfe','#93c5fd','#60a5fa','#3b82f6','#2563eb','#1d4ed8','#1e40af'], // Blue
  ['#e0e7ff','#c7d2fe','#a5b4fc','#818cf8','#6366f1','#4f46e5','#4338ca','#3730a3'], // Indigo
  ['#f3e8ff','#e9d5ff','#d8b4fe','#c084fc','#a855f7','#9333ea','#7e22ce','#6b21a8'], // Purple
  ['#fce7f3','#fbcfe8','#f9a8d4','#f472b6','#ec4899','#db2777','#be185d','#9d174d'], // Pink
  ['#f9fafb','#f3f4f6','#e5e7eb','#d1d5db','#9ca3af','#6b7280','#4b5563','#1f2937'], // Gray
];

// ---------------------------------------------------------------------------
// ColorPicker — floating popup with swatch grid + hex input
// ---------------------------------------------------------------------------
function ColorPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState('');
  const [popupStyle, setPopupStyle] = useState({});
  const buttonRef = useRef(null);
  const popupRef = useRef(null);

  // Sync hex field when popup opens or external value changes.
  useEffect(() => {
    setHexInput((value || '').replace(/^#/, ''));
  }, [value, open]);

  // Position popup below (or above) the trigger button, never off-screen.
  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popupW = 248;
    const popupH = 270;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = rect.left;
    if (left + popupW > vw - 8) left = vw - popupW - 8;

    let top = rect.bottom + 4;
    if (top + popupH > vh - 8) top = rect.top - popupH - 4;

    setPopupStyle({ position: 'fixed', top, left, zIndex: 9999 });
  }, [open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        popupRef.current && !popupRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const commitHex = () => {
    const raw = hexInput.trim();
    const full = raw.startsWith('#') ? raw : '#' + raw;
    if (/^#[0-9A-Fa-f]{6}$/.test(full)) {
      onChange(full.toLowerCase());
    }
  };

  const handleHexKeyDown = (e) => {
    if (e.key === 'Enter') { commitHex(); setOpen(false); }
    if (e.key === 'Escape') setOpen(false);
  };

  return (
    <>
      {/* Trigger button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2 py-1 border border-gray-200 rounded hover:border-gray-400 transition-colors"
        title="Pick theme color"
      >
        <span
          className="inline-block w-4 h-4 rounded border border-gray-300 shrink-0"
          style={{ backgroundColor: value || '#d1d5db' }}
        />
        <span className="text-xs text-gray-400">▾</span>
      </button>

      {/* Floating popup */}
      {open && (
        <div
          ref={popupRef}
          style={popupStyle}
          className="bg-white border border-gray-200 rounded-xl shadow-2xl p-3"
        >
          {/* Swatch grid: 10 columns (hues) × 8 rows (lightness) */}
          <div className="flex flex-col gap-0.5 mb-3">
            {Array.from({ length: 8 }, (_, row) => (
              <div key={row} className="flex gap-0.5">
                {PALETTE.map((col, colIdx) => (
                  <button
                    key={colIdx}
                    type="button"
                    onClick={() => { onChange(col[row]); setOpen(false); }}
                    title={col[row]}
                    className="rounded-sm transition-transform hover:scale-125 focus:outline-none"
                    style={{
                      width: 22,
                      height: 22,
                      backgroundColor: col[row],
                      boxShadow: value === col[row]
                        ? '0 0 0 2px #fff, 0 0 0 3.5px #1e293b'
                        : undefined,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100 mb-2" />

          {/* Preview swatch + hex input */}
          <div className="flex items-center gap-2">
            <span
              className="w-8 h-8 rounded-md border border-gray-200 shrink-0"
              style={{ backgroundColor: value || '#d1d5db' }}
            />
            <div className="flex flex-1 items-center border border-gray-200 rounded-md overflow-hidden text-xs">
              <span className="px-2 py-1.5 text-gray-400 bg-gray-50 border-r border-gray-200 select-none font-mono">
                #
              </span>
              <input
                type="text"
                value={hexInput}
                onChange={e => setHexInput(e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6))}
                onBlur={commitHex}
                onKeyDown={handleHexKeyDown}
                placeholder="e.g. 6366f1"
                maxLength={6}
                className="flex-1 px-1.5 py-1.5 focus:outline-none font-mono bg-white"
              />
            </div>
          </div>

          {/* Remove color link */}
          {value && (
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className="mt-2 w-full text-xs text-gray-400 hover:text-gray-600 text-center py-0.5 rounded hover:bg-gray-50"
            >
              Remove color
            </button>
          )}
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// ThemeInput — text input with autocomplete dropdown for existing themes
// ---------------------------------------------------------------------------
function ThemeInput({ value, suggestions, onChange, onSelect }) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef(null);

  // Filter to suggestions that contain what's typed (case-insensitive),
  // but don't show an exact match as a suggestion.
  const filtered = useMemo(() => {
    if (!value.trim()) return suggestions;
    const q = value.toLowerCase();
    return suggestions.filter(s => s.label.toLowerCase().includes(q) && s.label !== value);
  }, [value, suggestions]);

  // Reset active index when filtered list changes.
  useEffect(() => { setActiveIdx(-1); }, [filtered]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleKeyDown = (e) => {
    if (!open || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      const s = filtered[activeIdx];
      onSelect(s.label, s.color);
      setOpen(false);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Enter theme..."
        className="w-full text-xs px-1 py-1 focus:outline-none bg-transparent"
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 z-50 bg-white border border-gray-200 rounded shadow-lg min-w-[200px] max-h-48 overflow-y-auto">
          {filtered.map((s, idx) => (
            <button
              key={s.label}
              type="button"
              onMouseDown={e => e.preventDefault()} // keep input focused
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

const CASE_SENSITIVE_NOTE = (
  <p className="text-xs text-gray-400 mb-2">
    Theme grouping is case-sensitive. "Belonging" and "belonging" are treated as different themes.
  </p>
);

export default function ThemeTaggingView({ units, onCellChange, onColorChange }) {
  const [filterValue, setFilterValue] = useState('all');
  const [sortValue, setSortValue] = useState('original');

  // Build distinct theme labels for the filter dropdown.
  const distinctThemes = [...new Set(
    units.map(u => u.provisional_theme).filter(t => t && t.trim())
  )].sort();

  // Build deduplicated suggestions for autocomplete: [{label, color}]
  // First color seen for a given theme name wins.
  const suggestions = useMemo(() => {
    const seen = new Map();
    for (const u of units) {
      if (u.provisional_theme && u.provisional_theme.trim() && !seen.has(u.provisional_theme)) {
        seen.set(u.provisional_theme, u.theme_color || null);
      }
    }
    return [...seen.entries()]
      .map(([label, color]) => ({ label, color }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [units]);

  // Apply filter.
  let visible = units;
  if (filterValue === 'untagged') {
    visible = units.filter(u => !u.provisional_theme || !u.provisional_theme.trim());
  } else if (filterValue === 'tagged') {
    visible = units.filter(u => u.provisional_theme && u.provisional_theme.trim());
  } else if (filterValue !== 'all') {
    // Specific theme label selected.
    visible = units.filter(u => u.provisional_theme === filterValue);
  }

  // Apply sort.
  if (sortValue === 'theme') {
    visible = [...visible].sort((a, b) => {
      const at = a.provisional_theme || '';
      const bt = b.provisional_theme || '';
      if (!at && !bt) return a.mu_order - b.mu_order;
      if (!at) return 1;
      if (!bt) return -1;
      return at.localeCompare(bt) || a.mu_order - b.mu_order;
    });
  }

  if (units.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No meaning units found. Complete Stage 2 first.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter / sort toolbar */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 bg-gray-50 shrink-0 flex-wrap">
        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500">Filter:</label>
          <select
            value={filterValue}
            onChange={e => setFilterValue(e.target.value)}
            className="text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            <option value="all">All</option>
            <option value="untagged">Untagged only</option>
            <option value="tagged">Tagged only</option>
            {distinctThemes.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1">
          <label className="text-xs text-gray-500">Sort:</label>
          <select
            value={sortValue}
            onChange={e => setSortValue(e.target.value)}
            className="text-xs border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            <option value="original">Original order</option>
            <option value="theme">By theme</option>
          </select>
        </div>
      </div>

      {/* Case-sensitivity notice */}
      <div className="px-3 pt-2 shrink-0">
        {CASE_SENSITIVE_NOTE}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0 px-3 pb-3">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-left text-gray-500 bg-gray-50 sticky top-0 z-10">
              <th className="p-2 border border-gray-200 w-1/4">Boundary Justification</th>
              <th className="p-2 border border-gray-200 w-1/4">Paraphrase</th>
              <th className="p-2 border border-gray-200 w-1/5">Provisional Theme</th>
              <th className="p-2 border border-gray-200 w-8 text-center">Color</th>
              <th className="p-2 border border-gray-200">Stage 3 Notes</th>
            </tr>
          </thead>
          <tbody>
            {visible.map(unit => (
              <tr
                key={unit.id}
                className="align-top hover:bg-gray-50"
                style={unit.theme_color ? { borderLeft: `3px solid ${unit.theme_color}` } : {}}
              >
                {/* Boundary Justification — read-only */}
                <td className="p-2 border border-gray-200 text-gray-700 leading-relaxed">
                  {unit.boundary_justification || <span className="text-gray-300 italic">—</span>}
                </td>

                {/* Paraphrase — read-only */}
                <td className="p-2 border border-gray-200 text-gray-700 leading-relaxed">
                  {unit.paraphrase || <span className="text-gray-300 italic">—</span>}
                </td>

                {/* Provisional Theme — editable with autocomplete */}
                <td className="p-1 border border-gray-200">
                  <ThemeInput
                    value={unit.provisional_theme || ''}
                    suggestions={suggestions}
                    onChange={v => onCellChange(unit.id, 'provisional_theme', v)}
                    onSelect={(label, color) => {
                      onCellChange(unit.id, 'provisional_theme', label);
                      if (color) onColorChange(unit.id, color);
                    }}
                  />
                </td>

                {/* Color picker */}
                <td className="p-1 border border-gray-200 text-center">
                  <ColorPicker
                    value={unit.theme_color || ''}
                    onChange={color => onColorChange(unit.id, color)}
                  />
                </td>

                {/* Stage 3 Notes — editable */}
                <td className="p-1 border border-gray-200">
                  <textarea
                    value={unit.stage3_notes || ''}
                    onChange={e => onCellChange(unit.id, 'stage3_notes', e.target.value)}
                    placeholder="Notes..."
                    rows={2}
                    className="w-full text-xs p-1 resize-none focus:outline-none bg-transparent leading-relaxed"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
