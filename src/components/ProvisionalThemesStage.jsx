import React, { useState, useEffect, useCallback, useRef } from 'react';
import ThemeTaggingView from './ThemeTaggingView';
import ThemeGroupedView from './ThemeGroupedView';

export default function ProvisionalThemesStage({ transcript }) {
  const [units, setUnits] = useState([]);
  const [view, setView] = useState('tagging'); // 'tagging' | 'grouped'
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const [panelSearch, setPanelSearch] = useState('');

  const unitsRef = useRef([]);
  const dirtyIdsRef = useRef(new Set());
  const saveTimerRef = useRef(null);

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

  // ---------------------------------------------------------------------------
  // Save helpers
  // ---------------------------------------------------------------------------

  const performSave = useCallback(async () => {
    const ids = [...dirtyIdsRef.current];
    if (ids.length === 0) return;
    const toSave = unitsRef.current.filter(u => ids.includes(u.id));
    try {
      await Promise.all(toSave.map(mu => window.phenomAPI.saveMeaningUnit(mu)));
      dirtyIdsRef.current.clear();
      setSaveError(false);
      setLastSavedTime(new Date().toLocaleTimeString());
      window.dispatchEvent(new CustomEvent('phenomapp:highlights-changed'));
      window.dispatchEvent(new CustomEvent('phenomapp:data-saved'));
    } catch {
      setSaveError(true);
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(performSave, 3000);
  }, [performSave]);

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    return performSave();
  }, [performSave]);

  useEffect(() => {
    window.addEventListener('phenomapp:flush-saves', flushSave);
    return () => window.removeEventListener('phenomapp:flush-saves', flushSave);
  }, [flushSave]);

  // ---------------------------------------------------------------------------
  // Change handlers passed to child views
  // ---------------------------------------------------------------------------

  const handleCellChange = useCallback((id, field, value) => {
    setUnits(prev => {
      const updated = prev.map(u => u.id === id ? { ...u, [field]: value } : u);
      dirtyIdsRef.current.add(id);
      return updated;
    });
    scheduleSave();
  }, [scheduleSave]);

  const handleColorChange = useCallback(async (id, color) => {
    setUnits(prev => prev.map(u => u.id === id ? { ...u, theme_color: color } : u));
    try {
      await window.phenomAPI.saveMeaningUnitColor({ id, theme_color: color });
      setLastSavedTime(new Date().toLocaleTimeString());
      setSaveError(false);
      window.dispatchEvent(new CustomEvent('phenomapp:highlights-changed'));
      window.dispatchEvent(new CustomEvent('phenomapp:data-saved'));
    } catch {
      setSaveError(true);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      {/* Header with search + view toggle */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 shrink-0 flex items-center gap-2">
        <span className="text-xs font-medium text-gray-600 shrink-0">Stage 3: Provisional Themes</span>

        <div className="flex items-center gap-1 flex-1 justify-center">
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

        <div className="flex rounded border border-gray-200 overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => setView('tagging')}
            className={`px-2.5 py-1 text-xs transition-colors ${
              view === 'tagging'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-500 hover:bg-gray-100'
            }`}
          >
            View 1 — Tagging
          </button>
          <button
            type="button"
            onClick={() => setView('grouped')}
            className={`px-2.5 py-1 text-xs border-l border-gray-200 transition-colors ${
              view === 'grouped'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-500 hover:bg-gray-100'
            }`}
          >
            View 2 — Grouped
          </button>
        </div>
      </div>

      {/* Stage content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {view === 'tagging' ? (
          <ThemeTaggingView
            units={units}
            onCellChange={handleCellChange}
            onColorChange={handleColorChange}
            panelSearch={panelSearch}
          />
        ) : (
          <ThemeGroupedView
            units={units}
            onCellChange={handleCellChange}
            panelSearch={panelSearch}
          />
        )}
      </div>

      {/* Save status footer */}
      <div className={`px-4 py-1.5 border-t border-gray-100 text-xs shrink-0 ${saveError ? 'text-red-500' : 'text-gray-400'}`}>
        {saveError
          ? 'Save failed — check disk space'
          : lastSavedTime
          ? `Last saved ${lastSavedTime}`
          : 'Not yet saved'}
      </div>
    </div>
  );
}
