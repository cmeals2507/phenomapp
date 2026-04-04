import React, { useState, useRef, useEffect } from 'react';

const THEME_COLORS = [
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ef4444', // red
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#f97316', // orange
  '#14b8a6', // teal
  '#ec4899', // pink
  '#84cc16', // lime
];

function ColorPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-1.5 py-1 border border-gray-200 rounded hover:border-gray-400 transition-colors"
        title="Pick theme color"
      >
        <span
          className="inline-block w-3 h-3 rounded-full border border-gray-300"
          style={{ backgroundColor: value || '#d1d5db' }}
        />
        <span className="text-xs text-gray-500">▼</span>
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 p-1.5 bg-white border border-gray-200 rounded shadow-lg">
          <div className="grid grid-cols-5 gap-1">
            {THEME_COLORS.map(color => (
              <button
                key={color}
                type="button"
                onClick={() => { onChange(color); setOpen(false); }}
                className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  backgroundColor: color,
                  borderColor: value === color ? '#1e293b' : 'transparent',
                }}
                title={color}
              />
            ))}
          </div>
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
              <th className="p-2 border border-gray-200 w-1/4">Paraphrase</th>
              <th className="p-2 border border-gray-200 w-1/4">Stage 2 Notes</th>
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
                {/* Paraphrase — read-only */}
                <td className="p-2 border border-gray-200 text-gray-700 leading-relaxed">
                  {unit.paraphrase || <span className="text-gray-300 italic">—</span>}
                </td>

                {/* Analyst Note (Stage 2) — read-only */}
                <td className="p-2 border border-gray-200 text-gray-700 leading-relaxed">
                  {unit.analyst_note || <span className="text-gray-300 italic">—</span>}
                </td>

                {/* Provisional Theme — editable */}
                <td className="p-1 border border-gray-200">
                  <input
                    type="text"
                    value={unit.provisional_theme || ''}
                    onChange={e => onCellChange(unit.id, 'provisional_theme', e.target.value)}
                    placeholder="Enter theme..."
                    className="w-full text-xs px-1 py-1 focus:outline-none bg-transparent"
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
