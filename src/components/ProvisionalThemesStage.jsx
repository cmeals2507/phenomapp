import React, { useState, useEffect, useCallback, useRef } from 'react';
import ThemeTaggingView from './ThemeTaggingView';
import ThemeGroupedView from './ThemeGroupedView';

export default function ProvisionalThemesStage({ transcript }) {
  const [units, setUnits] = useState([]);
  const [view, setView] = useState('tagging'); // 'tagging' | 'grouped'
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [saveError, setSaveError] = useState(false);

  const unitsRef = useRef([]);
  const dirtyIdsRef = useRef(new Set());
  const saveTimerRef = useRef(null);

  useEffect(() => {
    unitsRef.current = units;
  }, [units]);

  // Load meaning units for this transcript.
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
      // Signal TranscriptPanel to refresh highlights.
      window.dispatchEvent(new CustomEvent('phenomapp:highlights-changed'));
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

  // Flush before app quits.
  useEffect(() => {
    window.addEventListener('phenomapp:flush-saves', flushSave);
    return () => window.removeEventListener('phenomapp:flush-saves', flushSave);
  }, [flushSave]);

  // ---------------------------------------------------------------------------
  // Change handlers passed to child views
  // ---------------------------------------------------------------------------

  // Debounced text-field change (provisional_theme, stage3_notes).
  const handleCellChange = useCallback((id, field, value) => {
    setUnits(prev => {
      const updated = prev.map(u => u.id === id ? { ...u, [field]: value } : u);
      dirtyIdsRef.current.add(id);
      return updated;
    });
    scheduleSave();
  }, [scheduleSave]);

  // Immediate color save — does NOT update day_stamps.
  const handleColorChange = useCallback(async (id, color) => {
    setUnits(prev => prev.map(u => u.id === id ? { ...u, theme_color: color } : u));
    try {
      await window.phenomAPI.saveMeaningUnitColor({ id, theme_color: color });
      setLastSavedTime(new Date().toLocaleTimeString());
      setSaveError(false);
      // Refresh highlights so new color appears in TranscriptPanel immediately.
      window.dispatchEvent(new CustomEvent('phenomapp:highlights-changed'));
    } catch {
      setSaveError(true);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full">
      {/* Header with view toggle */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 shrink-0 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">Stage 3: Provisional Themes</span>

        <div className="flex rounded border border-gray-200 overflow-hidden">
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
          />
        ) : (
          <ThemeGroupedView
            units={units}
            onCellChange={handleCellChange}
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
