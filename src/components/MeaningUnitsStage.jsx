import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';

function formatMUId(order) {
  return `MU-${String(order).padStart(3, '0')}`;
}

// Memoized row — only re-renders when its own unit data changes
const MURow = memo(function MURow({ unit, onCellChange, onDelete, onDragStart, onDragEnter, onDragEnd, onContextMenu }) {
  return (
    <tr
      draggable
      onDragStart={() => onDragStart(unit.id)}
      onDragEnter={() => onDragEnter(unit.id)}
      onDragEnd={onDragEnd}
      onDragOver={e => e.preventDefault()}
      onContextMenu={e => onContextMenu(e, unit.id)}
      className="hover:bg-gray-50 cursor-grab active:cursor-grabbing"
    >
      <td
        className="p-2 border border-gray-200 text-gray-400 font-mono text-center align-top select-none cursor-pointer hover:text-indigo-500 hover:bg-indigo-50 transition-colors"
        title={unit.excerpt ? 'Click to locate in transcript' : undefined}
        onClick={() => {
          if (!unit.excerpt) return;
          window.dispatchEvent(new CustomEvent('phenomapp:scroll-to-mu', { detail: { excerpt: unit.excerpt } }));
        }}
      >
        {formatMUId(unit.mu_order)}
      </td>
      {['excerpt', 'boundary_justification', 'paraphrase', 'analyst_note'].map(field => (
        <td key={field} className="p-1 border border-gray-200 align-top">
          <textarea
            value={unit[field] || ''}
            onChange={e => {
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
              onCellChange(unit.id, field, e.target.value);
            }}
            ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }}
            className="w-full text-xs p-1 resize-none focus:outline-none bg-transparent leading-relaxed"
            style={{ overflow: 'hidden', minHeight: '5rem' }}
          />
        </td>
      ))}
      <td className="p-1 border border-gray-200 align-top text-center">
        <button
          onClick={() => onDelete(unit.id)}
          className="text-gray-300 hover:text-red-500 text-sm p-1 leading-none"
          title="Delete row"
        >
          ✕
        </button>
      </td>
    </tr>
  );
});

export default function MeaningUnitsStage({ transcript }) {
  const [units, setUnits] = useState([]);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, unitId: null });
  const [panelSearch, setPanelSearch] = useState('');

  const unitsRef = useRef([]);
  const dirtyIdsRef = useRef(new Set());
  const saveTimerRef = useRef(null);
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  useEffect(() => {
    unitsRef.current = units;
  }, [units]);

  useEffect(() => {
    async function load() {
      const mus = await window.phenomAPI.getMeaningUnits(transcript.id);
      setUnits(mus);
    }
    load();
  }, [transcript.id]);

  useEffect(() => {
    if (!contextMenu.visible) return;
    const handler = () => setContextMenu(c => ({ ...c, visible: false }));
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [contextMenu.visible]);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const ids = [...dirtyIdsRef.current];
      if (ids.length === 0) return;
      const toSave = unitsRef.current.filter(u => ids.includes(u.id));
      try {
        await Promise.all(toSave.map(mu => window.phenomAPI.saveMeaningUnit(mu)));
        dirtyIdsRef.current.clear();
        setSaveError(false);
        setLastSavedTime(new Date().toLocaleTimeString());
        window.dispatchEvent(new CustomEvent('phenomapp:coverage-changed'));
        window.dispatchEvent(new CustomEvent('phenomapp:data-saved'));
      } catch {
        setSaveError(true);
      }
    }, 3000);
  }, []);

  const flushSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const ids = [...dirtyIdsRef.current];
    if (ids.length === 0) return;
    const toSave = unitsRef.current.filter(u => ids.includes(u.id));
    try {
      await Promise.all(toSave.map(mu => window.phenomAPI.saveMeaningUnit(mu)));
      dirtyIdsRef.current.clear();
      setLastSavedTime(new Date().toLocaleTimeString());
      window.dispatchEvent(new CustomEvent('phenomapp:coverage-changed'));
      window.dispatchEvent(new CustomEvent('phenomapp:data-saved'));
    } catch {
      setSaveError(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('phenomapp:flush-saves', flushSave);
    return () => window.removeEventListener('phenomapp:flush-saves', flushSave);
  }, [flushSave]);

  const handleCellChange = useCallback((id, field, value) => {
    setUnits(prev => {
      const updated = prev.map(u => u.id === id ? { ...u, [field]: value } : u);
      const unit = updated.find(u => u.id === id);
      if (unit) dirtyIdsRef.current.add(id);
      return updated;
    });
    scheduleSave();
  }, [scheduleSave]);

  const handleAddRow = async () => {
    const newMU = await window.phenomAPI.addMeaningUnit({
      transcriptId: transcript.id,
      workflow: transcript.workflow,
    });
    setUnits(prev => [...prev, newMU]);
  };

  const handleInsertAt = useCallback(async (insertAtOrder) => {
    setContextMenu(c => ({ ...c, visible: false }));
    await flushSave();
    await window.phenomAPI.insertMeaningUnitAt({
      transcriptId: transcript.id,
      workflow: transcript.workflow,
      insertAtOrder,
    });
    const mus = await window.phenomAPI.getMeaningUnits(transcript.id);
    setUnits(mus);
  }, [flushSave, transcript.id, transcript.workflow]);

  const handleDelete = useCallback(async (id) => {
    if (!window.confirm('Delete this meaning unit? This cannot be undone.')) return;
    await window.phenomAPI.deleteMeaningUnit(id);
    setUnits(prev => prev.filter(u => u.id !== id));
    dirtyIdsRef.current.delete(id);
    window.dispatchEvent(new CustomEvent('phenomapp:coverage-changed'));
  }, []);

  const handleDragStart = useCallback((unitId) => {
    dragItem.current = unitId;
  }, []);

  const handleDragEnter = useCallback((unitId) => {
    dragOverItem.current = unitId;
  }, []);

  const handleDragEnd = useCallback(async () => {
    const fromId = dragItem.current;
    const toId = dragOverItem.current;
    if (!fromId || !toId || fromId === toId) return;

    const current = unitsRef.current;
    const fromIdx = current.findIndex(u => u.id === fromId);
    const toIdx = current.findIndex(u => u.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;

    const newUnits = [...current];
    const [moved] = newUnits.splice(fromIdx, 1);
    newUnits.splice(toIdx, 0, moved);

    const reordered = newUnits.map((u, i) => ({ ...u, mu_order: i + 1 }));
    setUnits(reordered);

    await window.phenomAPI.reorderMeaningUnits(
      reordered.map(u => ({ id: u.id, mu_order: u.mu_order }))
    );

    setLastSavedTime(new Date().toLocaleTimeString());
    dragItem.current = null;
    dragOverItem.current = null;
  }, []);

  const handleRowContextMenu = useCallback((e, unitId) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, unitId });
  }, []);

  const visibleUnits = useMemo(() => {
    if (!panelSearch.trim()) return units;
    const q = panelSearch.toLowerCase();
    return units.filter(u =>
      ['excerpt', 'boundary_justification', 'paraphrase', 'analyst_note'].some(f =>
        (u[f] || '').toLowerCase().includes(q)
      )
    );
  }, [units, panelSearch]);

  const contextUnit = contextMenu.unitId ? units.find(u => u.id === contextMenu.unitId) : null;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 shrink-0 flex items-center gap-2">
        <span className="text-xs font-medium text-gray-600 shrink-0">Stage 2: Meaning Units</span>
        <div className="ml-auto flex items-center gap-1">
          <input
            type="text"
            value={panelSearch}
            onChange={e => setPanelSearch(e.target.value)}
            placeholder="Search rows..."
            className="text-xs border border-gray-200 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white w-32"
          />
          {panelSearch && (
            <button
              onClick={() => setPanelSearch('')}
              className="text-xs text-gray-400 hover:text-gray-600 px-1 leading-none"
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 min-h-0">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="text-left text-gray-500 bg-gray-50 sticky top-0">
              <th className="p-2 border border-gray-200 w-14 text-center">ID</th>
              <th className="p-2 border border-gray-200 w-1/4">Excerpt</th>
              <th className="p-2 border border-gray-200 w-1/4">Boundary Justification</th>
              <th className="p-2 border border-gray-200 w-1/4">Paraphrase</th>
              <th className="p-2 border border-gray-200">Analyst Note</th>
              <th className="p-2 border border-gray-200 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {visibleUnits.map(unit => (
              <MURow
                key={unit.id}
                unit={unit}
                onCellChange={handleCellChange}
                onDelete={handleDelete}
                onDragStart={handleDragStart}
                onDragEnter={handleDragEnter}
                onDragEnd={handleDragEnd}
                onContextMenu={handleRowContextMenu}
              />
            ))}
          </tbody>
        </table>

        {visibleUnits.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6">
            {panelSearch ? 'No matching rows.' : 'No meaning units yet. Click "+ Add Row" to begin.'}
          </p>
        )}

        {!panelSearch && (
          <button
            onClick={handleAddRow}
            className="mt-3 text-xs px-3 py-1.5 border border-dashed border-gray-300 rounded text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
          >
            + Add Row
          </button>
        )}
      </div>

      <div className={`px-4 py-1.5 border-t border-gray-100 text-xs shrink-0 ${saveError ? 'text-red-500' : 'text-gray-400'}`}>
        {saveError
          ? 'Save failed — check disk space'
          : lastSavedTime
          ? `Last saved ${lastSavedTime}`
          : 'Not yet saved'}
      </div>

      {contextMenu.visible && contextUnit && (
        <div
          style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 1000 }}
          className="bg-white border border-gray-200 rounded shadow-lg py-1 text-xs min-w-[160px]"
          onMouseDown={e => e.stopPropagation()}
        >
          <button
            className="block w-full text-left px-4 py-1.5 hover:bg-gray-100 text-gray-700"
            onClick={() => handleInsertAt(contextUnit.mu_order)}
          >
            Add row above
          </button>
          <button
            className="block w-full text-left px-4 py-1.5 hover:bg-gray-100 text-gray-700"
            onClick={() => handleInsertAt(contextUnit.mu_order + 1)}
          >
            Add row below
          </button>
        </div>
      )}
    </div>
  );
}
