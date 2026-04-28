import React, { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo, memo } from 'react';
import MemoLinkModal from './MemoLinkModal';

function formatMUId(order) {
  return `MU-${String(order).padStart(3, '0')}`;
}

// Memoized row — only re-renders when its own unit data changes
const MURow = memo(function MURow({ unit, hasMemoLink, onCellChange, onDelete, onDragStart, onDragEnter, onDragEnd, onContextMenu, onOpenMemoLink }) {
  const rowRef = useRef(null);
  useLayoutEffect(() => {
    if (!rowRef.current) return;
    rowRef.current.querySelectorAll('textarea').forEach(el => {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <tr
      ref={rowRef}
      draggable
      onDragStart={() => onDragStart(unit.id)}
      onDragEnter={() => onDragEnter(unit.id)}
      onDragEnd={onDragEnd}
      onDragOver={e => e.preventDefault()}
      onContextMenu={e => onContextMenu(e, unit.id)}
      className="hover:bg-gray-50 cursor-grab active:cursor-grabbing"
    >
      <td className="p-2 border border-gray-200 text-center align-top select-none">
        <div className="flex flex-col items-center gap-1.5">
          <span
            className="text-gray-400 font-mono text-xs cursor-pointer hover:text-indigo-500 transition-colors rounded px-0.5"
            title={unit.excerpt ? 'Click to locate in transcript' : undefined}
            onClick={() => {
              if (!unit.excerpt) return;
              window.dispatchEvent(new CustomEvent('phenomapp:scroll-to-mu', { detail: { excerpt: unit.excerpt } }));
            }}
          >
            {formatMUId(unit.mu_order)}
          </span>
          <button
            onClick={() => onOpenMemoLink(unit.id, unit.mu_order)}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              hasMemoLink
                ? 'bg-green-500 hover:bg-green-600'
                : 'bg-orange-400 hover:bg-orange-500'
            }`}
            title={
              hasMemoLink
                ? 'Memo linked — highlight active. Click to manage links.'
                : 'No memo link — highlight inactive. Click to link a holistic memo passage.'
            }
          />
        </div>
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

// Inline log entry — click to expand order snapshot
function ReorderLogEntry({ entry, units }) {
  const [expanded, setExpanded] = useState(false);

  const muCount = (() => {
    try { return JSON.parse(entry.order_snapshot).length; } catch { return '?'; }
  })();

  const snapshot = expanded ? (() => {
    try {
      const ids = JSON.parse(entry.order_snapshot);
      return ids.map((id, i) => {
        const u = units.find(u => u.id === id);
        return `${i + 1}. ${u ? formatMUId(u.mu_order) : `id:${id}`}`;
      }).join('  ');
    } catch { return entry.order_snapshot; }
  })() : null;

  const ts = entry.reordered_at.replace('T', ' ').replace(/\.\d+Z$/, '');

  return (
    <div className="border border-gray-100 rounded p-1.5 bg-gray-50 text-xs">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left flex items-center gap-2 text-gray-500 hover:text-gray-700"
      >
        <span className="font-mono shrink-0">{ts}</span>
        <span className="shrink-0">Reordered — {muCount} units</span>
        {entry.note && <span className="text-gray-600 italic truncate">"{entry.note}"</span>}
        <span className="ml-auto text-gray-300 shrink-0">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && snapshot && (
        <p className="mt-1.5 text-gray-500 leading-relaxed pl-2 border-t border-gray-100 pt-1.5">
          {snapshot}
        </p>
      )}
    </div>
  );
}

const MAX_UNDO = 3;

export default function MeaningUnitsStage({ transcript }) {
  const [units, setUnits] = useState([]);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, unitId: null });
  const [panelSearch, setPanelSearch] = useState('');
  const [canUndo, setCanUndo] = useState(false);

  // Memo link state
  const [memoLinkedIds, setMemoLinkedIds] = useState(new Set()); // Set of mu_id with ≥1 link
  const [memoLinkTarget, setMemoLinkTarget] = useState(null); // { muId, muOrder }

  // Reorder audit log state
  const [reorderNote, setReorderNote] = useState(null); // { logId, text, visible }
  const [showHistory, setShowHistory] = useState(false);
  const [reorderHistory, setReorderHistory] = useState(null); // null = not yet loaded

  const unitsRef = useRef([]);
  const dirtyIdsRef = useRef(new Set());
  const saveTimerRef = useRef(null);
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);
  // Undo stack: each entry is a snapshot of [{id, display_order}] before a reorder.
  const undoStackRef = useRef([]);

  useEffect(() => {
    unitsRef.current = units;
  }, [units]);

  const loadMemoLinks = useCallback(async () => {
    const links = await window.phenomAPI.getMemoLinks(transcript.id);
    setMemoLinkedIds(new Set(links.map(l => l.mu_id)));
  }, [transcript.id]);

  useEffect(() => {
    async function load() {
      const mus = await window.phenomAPI.getMeaningUnits(transcript.id);
      setUnits(mus);
    }
    load();
    loadMemoLinks();
    // Reset per-transcript state
    setMemoLinkTarget(null);
    setReorderNote(null);
    setShowHistory(false);
    setReorderHistory(null);
    undoStackRef.current = [];
    setCanUndo(false);
  }, [transcript.id, loadMemoLinks]);

  // Refresh link indicators when MemoLinkModal makes changes
  useEffect(() => {
    const handler = () => loadMemoLinks();
    window.addEventListener('phenomapp:memo-links-changed', handler);
    return () => window.removeEventListener('phenomapp:memo-links-changed', handler);
  }, [loadMemoLinks]);

  useEffect(() => {
    if (!contextMenu.visible) return;
    const handler = () => setContextMenu(c => ({ ...c, visible: false }));
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [contextMenu.visible]);

  // Auto-dismiss reorder note prompt after 10 seconds
  useEffect(() => {
    if (!reorderNote?.visible) return;
    const timer = setTimeout(() => {
      setReorderNote(n => n ? { ...n, visible: false } : n);
    }, 10000);
    return () => clearTimeout(timer);
  }, [reorderNote?.visible, reorderNote?.logId]);

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

  // ---------------------------------------------------------------------------
  // Undo helpers
  // ---------------------------------------------------------------------------

  const pushUndo = useCallback((currentUnits) => {
    const snapshot = currentUnits.map(u => ({ id: u.id, display_order: u.display_order }));
    undoStackRef.current = [...undoStackRef.current, snapshot].slice(-MAX_UNDO);
    setCanUndo(true);
  }, []);

  const handleUndo = useCallback(async () => {
    if (undoStackRef.current.length === 0) return;
    const prevState = undoStackRef.current[undoStackRef.current.length - 1];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    setCanUndo(undoStackRef.current.length > 0);

    const current = unitsRef.current;
    const restored = current
      .map(u => {
        const prev = prevState.find(p => p.id === u.id);
        return prev ? { ...u, display_order: prev.display_order } : u;
      })
      .sort((a, b) => a.display_order - b.display_order);

    setUnits(restored);
    await window.phenomAPI.reorderMeaningUnits(
      restored.map(u => ({ id: u.id, display_order: u.display_order }))
    );

    const now = new Date().toISOString();
    const result = await window.phenomAPI.logMUReorder({
      transcriptId: transcript.id,
      reorderedAt: now,
      orderSnapshot: JSON.stringify(restored.map(u => u.id)),
    });
    if (result?.id) {
      await window.phenomAPI.updateReorderLogNote({ id: result.id, note: 'undo' });
    }

    window.dispatchEvent(new CustomEvent('phenomapp:coverage-changed'));
    setLastSavedTime(new Date().toLocaleTimeString());
  }, [transcript.id]);

  // Cmd+Z outside text fields → app-level undo
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        const active = document.activeElement;
        const isTextField = active && (
          active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.isContentEditable
        );
        if (!isTextField && undoStackRef.current.length > 0) {
          e.preventDefault();
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo]);

  // ---------------------------------------------------------------------------
  // Cell and row handlers
  // ---------------------------------------------------------------------------

  const handleCellChange = useCallback((id, field, value) => {
    setUnits(prev => {
      const updated = prev.map(u => u.id === id ? { ...u, [field]: value } : u);
      const unit = updated.find(u => u.id === id);
      if (unit) dirtyIdsRef.current.add(id);
      return updated;
    });
    scheduleSave();
  }, [scheduleSave]);

  const handleOpenMemoLink = useCallback((muId, muOrder) => {
    setMemoLinkTarget({ muId, muOrder });
  }, []);

  const handleAddRow = async () => {
    const newMU = await window.phenomAPI.addMeaningUnit({
      transcriptId: transcript.id,
      workflow: transcript.workflow,
    });
    setUnits(prev => [...prev, newMU]);
  };

  const handleInsertAt = useCallback(async (insertAtDisplayOrder) => {
    setContextMenu(c => ({ ...c, visible: false }));
    await flushSave();
    await window.phenomAPI.insertMeaningUnitAt({
      transcriptId: transcript.id,
      workflow: transcript.workflow,
      insertAtOrder: insertAtDisplayOrder,
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
    dragItem.current = null;
    dragOverItem.current = null;
    if (!fromId || !toId || fromId === toId) return;

    const current = unitsRef.current;
    const fromIdx = current.findIndex(u => u.id === fromId);
    const toIdx = current.findIndex(u => u.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;

    // Snapshot before change for undo
    pushUndo(current);

    const newUnits = [...current];
    const [moved] = newUnits.splice(fromIdx, 1);
    newUnits.splice(toIdx, 0, moved);

    // Assign sequential display_orders — mu_order (canonical ID) is never touched.
    const reordered = newUnits.map((u, i) => ({ ...u, display_order: i + 1 }));
    setUnits(reordered);

    await window.phenomAPI.reorderMeaningUnits(
      reordered.map(u => ({ id: u.id, display_order: u.display_order }))
    );

    // Log the reorder event
    const now = new Date().toISOString();
    const orderSnapshot = JSON.stringify(reordered.map(u => u.id));
    const result = await window.phenomAPI.logMUReorder({
      transcriptId: transcript.id,
      reorderedAt: now,
      orderSnapshot,
    });
    if (result?.id) {
      setReorderNote({ logId: result.id, text: '', visible: true });
    }

    setLastSavedTime(new Date().toLocaleTimeString());
  }, [transcript.id, pushUndo]);

  // Reset display_order to canonical mu_order sequence
  const handleSortByMUId = useCallback(async () => {
    const current = unitsRef.current;
    const sorted = [...current].sort((a, b) => a.mu_order - b.mu_order);
    const alreadySorted = current.every((u, i) => u.id === sorted[i].id);
    if (alreadySorted) return;

    pushUndo(current);
    const reordered = sorted.map((u, i) => ({ ...u, display_order: i + 1 }));
    setUnits(reordered);

    await window.phenomAPI.reorderMeaningUnits(
      reordered.map(u => ({ id: u.id, display_order: u.display_order }))
    );

    const now = new Date().toISOString();
    const result = await window.phenomAPI.logMUReorder({
      transcriptId: transcript.id,
      reorderedAt: now,
      orderSnapshot: JSON.stringify(reordered.map(u => u.id)),
    });
    if (result?.id) {
      await window.phenomAPI.updateReorderLogNote({ id: result.id, note: 'sorted by MU-ID' });
    }

    window.dispatchEvent(new CustomEvent('phenomapp:coverage-changed'));
    setLastSavedTime(new Date().toLocaleTimeString());
  }, [transcript.id, pushUndo]);

  const handleSaveReorderNote = useCallback(async () => {
    if (!reorderNote?.logId) return;
    await window.phenomAPI.updateReorderLogNote({ id: reorderNote.logId, note: reorderNote.text });
    setReorderNote(n => n ? { ...n, visible: false } : n);
    // Refresh history if open
    setReorderHistory(null);
  }, [reorderNote]);

  const handleToggleHistory = useCallback(async () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next) {
      const history = await window.phenomAPI.getReorderLog(transcript.id);
      setReorderHistory(history);
    }
  }, [showHistory, transcript.id]);

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
          {canUndo && (
            <button
              onClick={handleUndo}
              title={`Undo last reorder (${undoStackRef.current.length} step${undoStackRef.current.length !== 1 ? 's' : ''} available) — or press ⌘Z`}
              className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 shrink-0"
            >
              Undo
            </button>
          )}
          <button
            onClick={handleSortByMUId}
            title="Reset display order to canonical MU-ID creation order"
            className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700 shrink-0"
          >
            Sort by MU-ID
          </button>
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
              <th className="p-2 border border-gray-200 w-14 text-center" title="Canonical ID — never changes on reorder">ID</th>
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
                hasMemoLink={memoLinkedIds.has(unit.id)}
                onCellChange={handleCellChange}
                onDelete={handleDelete}
                onDragStart={handleDragStart}
                onDragEnter={handleDragEnter}
                onDragEnd={handleDragEnd}
                onContextMenu={handleRowContextMenu}
                onOpenMemoLink={handleOpenMemoLink}
              />
            ))}
          </tbody>
        </table>

        {visibleUnits.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-6">
            {panelSearch ? 'No matching rows.' : 'No meaning units yet. Click "+ Add Row" to begin.'}
          </p>
        )}

        {/* Reorder note prompt */}
        {reorderNote?.visible && (
          <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded text-xs flex flex-col gap-2">
            <p className="text-amber-700">Row order changed. Add a note explaining why? (optional)</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={reorderNote.text}
                onChange={e => setReorderNote(n => ({ ...n, text: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveReorderNote();
                  if (e.key === 'Escape') setReorderNote(n => ({ ...n, visible: false }));
                }}
                placeholder="Reason for reorder..."
                className="flex-1 border border-amber-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
                autoFocus
              />
              <button
                onClick={handleSaveReorderNote}
                className="text-xs px-2.5 py-1 bg-amber-500 text-white rounded hover:bg-amber-600 shrink-0"
              >
                Save note
              </button>
              <button
                onClick={() => setReorderNote(n => ({ ...n, visible: false }))}
                className="text-xs px-2 py-1 text-gray-500 hover:text-gray-700 shrink-0"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Reorder history disclosure */}
        <div className="mt-3">
          <button
            onClick={handleToggleHistory}
            className="text-xs text-gray-400 hover:text-indigo-500 transition-colors flex items-center gap-1"
          >
            <span>{showHistory ? '▼' : '▶'}</span>
            <span>Reorder history</span>
          </button>
          {showHistory && (
            <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
              {reorderHistory === null ? (
                <p className="text-xs text-gray-400">Loading…</p>
              ) : reorderHistory.length === 0 ? (
                <p className="text-xs text-gray-400">No reorder events recorded.</p>
              ) : (
                reorderHistory.map(entry => (
                  <ReorderLogEntry key={entry.id} entry={entry} units={units} />
                ))
              )}
            </div>
          )}
        </div>

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
            onClick={() => handleInsertAt(contextUnit.display_order)}
          >
            Add row above
          </button>
          <button
            className="block w-full text-left px-4 py-1.5 hover:bg-gray-100 text-gray-700"
            onClick={() => handleInsertAt(contextUnit.display_order + 1)}
          >
            Add row below
          </button>
        </div>
      )}

      {memoLinkTarget && (
        <MemoLinkModal
          transcriptId={transcript.id}
          muId={memoLinkTarget.muId}
          muOrder={memoLinkTarget.muOrder}
          unit={units.find(u => u.id === memoLinkTarget.muId)}
          stage="stage2"
          onClose={() => setMemoLinkTarget(null)}
          onLinksChanged={loadMemoLinks}
          onCellChange={handleCellChange}
        />
      )}
    </div>
  );
}
