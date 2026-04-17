import React, { useState, useEffect, useCallback, useRef } from 'react';

function formatMUId(order) {
  return `MU-${String(order).padStart(3, '0')}`;
}

export default function MeaningUnitsStage({ transcript }) {
  const [units, setUnits] = useState([]);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, unitIndex: null });

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

  // Close context menu on any click outside it.
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

  const handleInsertAt = async (insertAtOrder) => {
    setContextMenu(c => ({ ...c, visible: false }));
    // Flush any pending edits before re-ordering.
    await flushSave();
    await window.phenomAPI.insertMeaningUnitAt({
      transcriptId: transcript.id,
      workflow: transcript.workflow,
      insertAtOrder,
    });
    // Reload all units — mu_order values on existing rows have shifted.
    const mus = await window.phenomAPI.getMeaningUnits(transcript.id);
    setUnits(mus);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this meaning unit? This cannot be undone.')) return;
    await window.phenomAPI.deleteMeaningUnit(id);
    setUnits(prev => prev.filter(u => u.id !== id));
    dirtyIdsRef.current.delete(id);
    window.dispatchEvent(new CustomEvent('phenomapp:coverage-changed'));
  };

  const handleDragStart = (index) => {
    dragItem.current = index;
  };

  const handleDragEnter = (index) => {
    dragOverItem.current = index;
  };

  const handleDragEnd = async () => {
    const from = dragItem.current;
    const to = dragOverItem.current;
    if (from === null || to === null || from === to) return;

    const newUnits = [...units];
    const [moved] = newUnits.splice(from, 1);
    newUnits.splice(to, 0, moved);

    const reordered = newUnits.map((u, i) => ({ ...u, mu_order: i + 1 }));
    setUnits(reordered);

    await window.phenomAPI.reorderMeaningUnits(
      reordered.map(u => ({ id: u.id, mu_order: u.mu_order }))
    );

    setLastSavedTime(new Date().toLocaleTimeString());
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const handleRowContextMenu = (e, index) => {
    e.preventDefault();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, unitIndex: index });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 shrink-0">
        <span className="text-xs font-medium text-gray-600">Stage 2: Meaning Units</span>
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
            {units.map((unit, index) => (
              <tr
                key={unit.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragEnter={() => handleDragEnter(index)}
                onDragEnd={handleDragEnd}
                onDragOver={e => e.preventDefault()}
                onContextMenu={e => handleRowContextMenu(e, index)}
                className="hover:bg-gray-50 cursor-grab active:cursor-grabbing"
              >
                <td className="p-2 border border-gray-200 text-gray-400 font-mono text-center align-top select-none">
                  {formatMUId(unit.mu_order)}
                </td>
                {['excerpt', 'boundary_justification', 'paraphrase', 'analyst_note'].map(field => (
                  <td key={field} className="p-1 border border-gray-200 align-top">
                    <textarea
                      value={unit[field] || ''}
                      onChange={e => handleCellChange(unit.id, field, e.target.value)}
                      className="w-full text-xs p-1 resize-none focus:outline-none bg-transparent leading-relaxed"
                      rows={4}
                      style={{ minHeight: '5rem' }}
                    />
                  </td>
                ))}
                <td className="p-1 border border-gray-200 align-top text-center">
                  <button
                    onClick={() => handleDelete(unit.id)}
                    className="text-gray-300 hover:text-red-500 text-sm p-1 leading-none"
                    title="Delete row"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {units.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6">
            No meaning units yet. Click "+ Add Row" to begin.
          </p>
        )}

        <button
          onClick={handleAddRow}
          className="mt-3 text-xs px-3 py-1.5 border border-dashed border-gray-300 rounded text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
        >
          + Add Row
        </button>
      </div>

      <div className={`px-4 py-1.5 border-t border-gray-100 text-xs shrink-0 ${saveError ? 'text-red-500' : 'text-gray-400'}`}>
        {saveError
          ? 'Save failed — check disk space'
          : lastSavedTime
          ? `Last saved ${lastSavedTime}`
          : 'Not yet saved'}
      </div>

      {/* Right-click context menu */}
      {contextMenu.visible && contextMenu.unitIndex !== null && (
        <div
          style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 1000 }}
          className="bg-white border border-gray-200 rounded shadow-lg py-1 text-xs min-w-[160px]"
          onMouseDown={e => e.stopPropagation()}
        >
          <button
            className="block w-full text-left px-4 py-1.5 hover:bg-gray-100 text-gray-700"
            onClick={() => handleInsertAt(units[contextMenu.unitIndex].mu_order)}
          >
            Add row above
          </button>
          <button
            className="block w-full text-left px-4 py-1.5 hover:bg-gray-100 text-gray-700"
            onClick={() => handleInsertAt(units[contextMenu.unitIndex].mu_order + 1)}
          >
            Add row below
          </button>
        </div>
      )}
    </div>
  );
}
