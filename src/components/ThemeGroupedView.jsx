import React, { useState, useMemo, memo } from 'react';

function formatMUId(order) {
  return `MU-${String(order).padStart(3, '0')}`;
}

function dispatchScrollToMU(excerpt) {
  if (!excerpt) return;
  window.dispatchEvent(new CustomEvent('phenomapp:scroll-to-mu', { detail: { excerpt } }));
}

const CASE_SENSITIVE_NOTE = (
  <p className="text-xs text-gray-400 mb-3">
    Theme grouping is case-sensitive. "Belonging" and "belonging" are treated as different themes.
  </p>
);

// Memoized row — only re-renders when its own MU data changes
const GroupedMURow = memo(function GroupedMURow({ mu, onCellChange, isUntagged }) {
  return (
    <div className="flex gap-0 text-xs">
      <div className="w-1/2 p-2 text-gray-700 leading-relaxed border-r border-gray-100 flex flex-col gap-1">
        <div className="flex items-start gap-1.5">
          <span
            className="font-mono text-gray-400 hover:text-indigo-500 cursor-pointer shrink-0 select-none transition-colors"
            title={mu.excerpt ? 'Click to locate in transcript' : undefined}
            onClick={() => dispatchScrollToMU(mu.excerpt)}
          >
            {formatMUId(mu.mu_order)}
          </span>
          <span>
            {isUntagged
              ? (mu.paraphrase || <span className="text-gray-300 italic">—</span>)
              : (mu.boundary_justification || <span className="text-gray-300 italic">—</span>)
            }
          </span>
        </div>
        {!isUntagged && mu.assignment_rationale && (
          <p className="text-gray-400 italic pl-7 leading-snug">{mu.assignment_rationale}</p>
        )}
      </div>
      <div className="w-1/2 p-1">
        <textarea
          value={mu.stage3_notes || ''}
          onChange={e => {
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
            onCellChange(mu.id, 'stage3_notes', e.target.value);
          }}
          placeholder="Stage 3 notes..."
          ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
          className="w-full text-xs p-1 resize-none focus:outline-none bg-transparent leading-relaxed"
          style={{ overflow: 'hidden', minHeight: '2.5rem' }}
        />
      </div>
    </div>
  );
});

export default function ThemeGroupedView({ units, onCellChange, panelSearch }) {
  const [collapsed, setCollapsed] = useState({});

  const toggleCollapse = (key) => {
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Apply panel search filter
  const filteredUnits = useMemo(() => {
    if (!panelSearch?.trim()) return units;
    const q = panelSearch.toLowerCase();
    return units.filter(u =>
      ['boundary_justification', 'paraphrase', 'provisional_theme', 'assignment_rationale', 'stage3_notes'].some(f =>
        (u[f] || '').toLowerCase().includes(q)
      )
    );
  }, [units, panelSearch]);

  if (units.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        No meaning units found. Complete Stage 2 first.
      </div>
    );
  }

  // Group filtered units by provisional_theme
  const groups = new Map();
  const untagged = [];

  for (const mu of filteredUnits) {
    const label = mu.provisional_theme && mu.provisional_theme.trim() ? mu.provisional_theme : null;
    if (!label) {
      untagged.push(mu);
    } else {
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(mu);
    }
  }

  if (groups.size === 0 && untagged.length > 0 && !panelSearch) {
    return (
      <div className="h-full overflow-auto p-4">
        {CASE_SENSITIVE_NOTE}
        <p className="text-sm text-gray-400 text-center mt-8">
          No themes defined yet. Switch to View 1 to begin tagging.
        </p>
      </div>
    );
  }

  if (filteredUnits.length === 0) {
    return (
      <div className="h-full overflow-auto p-4">
        {CASE_SENSITIVE_NOTE}
        <p className="text-sm text-gray-400 text-center mt-8">
          No matching rows.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-3">
      {CASE_SENSITIVE_NOTE}

      <div className="space-y-3">
        {[...groups.entries()].map(([label, groupUnits]) => {
          const color = groupUnits[0]?.theme_color || null;
          const isCollapsed = collapsed[label];

          return (
            <div key={label} className="border border-gray-200 rounded">
              <button
                type="button"
                onClick={() => toggleCollapse(label)}
                className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-left rounded-t transition-colors"
              >
                <span className="text-xs text-gray-500">{isCollapsed ? '▶' : '▼'}</span>
                {color && (
                  <span
                    className="inline-block w-3 h-3 rounded-full shrink-0 border border-gray-300"
                    style={{ backgroundColor: color }}
                  />
                )}
                <span className="text-xs font-medium text-gray-700 flex-1 truncate">{label}</span>
                <span className="text-xs text-gray-400 shrink-0">({groupUnits.length})</span>
              </button>

              {!isCollapsed && (
                <div className="divide-y divide-gray-100">
                  {groupUnits.map(mu => (
                    <GroupedMURow
                      key={mu.id}
                      mu={mu}
                      onCellChange={onCellChange}
                      isUntagged={false}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {untagged.length > 0 && (
          <div className="border border-gray-200 rounded">
            <button
              type="button"
              onClick={() => toggleCollapse('__untagged__')}
              className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-left rounded-t transition-colors"
            >
              <span className="text-xs text-gray-500">
                {collapsed['__untagged__'] ? '▶' : '▼'}
              </span>
              <span className="text-xs font-medium text-gray-400 flex-1">Untagged</span>
              <span className="text-xs text-gray-400 shrink-0">({untagged.length})</span>
            </button>

            {!collapsed['__untagged__'] && (
              <div className="divide-y divide-gray-100">
                {untagged.map(mu => (
                  <GroupedMURow
                    key={mu.id}
                    mu={mu}
                    onCellChange={onCellChange}
                    isUntagged={true}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
