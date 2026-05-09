import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAutoSave } from '../utils/autoSave';

export default function FreeformStage({ transcript, stage, stageLabel }) {
  const [content, setContent] = useState('');
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const contentRef = useRef('');
  const textareaRef = useRef(null);

  // Find-in-text
  const [showFind, setShowFind] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [findIndex, setFindIndex] = useState(0);
  const findInputRef = useRef(null);

  const performSave = useCallback(async (value) => {
    try {
      await window.phenomAPI.saveStageOutput({
        transcriptId: transcript.id,
        stage,
        content: value,
      });
      setSaveError(false);
      setLastSavedTime(new Date().toLocaleTimeString());
      window.dispatchEvent(new CustomEvent('phenomapp:data-saved'));
    } catch {
      setSaveError(true);
    }
  }, [transcript.id, stage]);

  const { triggerSave, flushSave } = useAutoSave(performSave, 3000);

  useEffect(() => {
    async function load() {
      const record = await window.phenomAPI.getStageOutput({
        transcriptId: transcript.id,
        stage,
      });
      const text = record?.content || '';
      setContent(text);
      contentRef.current = text;
      if (record?.updated_at) {
        setLastSavedTime(new Date(record.updated_at).toLocaleTimeString());
      }
    }
    load();
    setShowFind(false);
    setFindQuery('');
    setFindIndex(0);
  }, [transcript.id, stage]);

  useEffect(() => {
    const handleFlush = () => flushSave(contentRef.current);
    window.addEventListener('phenomapp:flush-saves', handleFlush);
    return () => window.removeEventListener('phenomapp:flush-saves', handleFlush);
  }, [flushSave]);

  const handleChange = (e) => {
    const val = e.target.value;
    setContent(val);
    contentRef.current = val;
    triggerSave(val);
  };

  // Compute match positions
  const findMatches = useMemo(() => {
    if (!findQuery.trim() || !content) return [];
    const q = findQuery.toLowerCase();
    const text = content.toLowerCase();
    const matches = [];
    let pos = 0;
    while (pos < text.length) {
      const idx = text.indexOf(q, pos);
      if (idx === -1) break;
      matches.push(idx);
      pos = idx + 1;
    }
    return matches;
  }, [findQuery, content]);

  // Clamp index when match list changes
  useEffect(() => {
    setFindIndex(i => findMatches.length === 0 ? 0 : Math.min(i, findMatches.length - 1));
  }, [findMatches.length]);

  // Scroll textarea to current match via selection
  useEffect(() => {
    if (!textareaRef.current || findMatches.length === 0 || !findQuery.trim()) return;
    const pos = findMatches[findIndex];
    const ta = textareaRef.current;
    ta.focus();
    ta.setSelectionRange(pos, pos + findQuery.length);
    // Bring selection into vertical center of the textarea
    const linesAbove = content.slice(0, pos).split('\n').length - 1;
    const lineH = parseFloat(getComputedStyle(ta).lineHeight) || 22;
    const visibleLines = Math.floor(ta.clientHeight / lineH);
    ta.scrollTop = Math.max(0, (linesAbove - Math.floor(visibleLines / 2)) * lineH);
  }, [findIndex, findMatches, findQuery, content]);

  const openFind = () => {
    setShowFind(true);
    setFindIndex(0);
    setTimeout(() => findInputRef.current?.focus(), 0);
  };

  const closeFind = () => {
    setShowFind(false);
    setFindQuery('');
    setFindIndex(0);
    textareaRef.current?.focus();
  };

  const stepFind = useCallback((dir) => {
    if (findMatches.length === 0) return;
    setFindIndex(i => (i + dir + findMatches.length) % findMatches.length);
  }, [findMatches.length]);

  const handleFindKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); stepFind(e.shiftKey ? -1 : 1); }
    if (e.key === 'Escape') closeFind();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 shrink-0 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-600">{stageLabel}</span>
        <button
          onClick={showFind ? closeFind : openFind}
          className={`text-xs px-2 py-0.5 rounded transition-colors flex items-center gap-1 ${
            showFind
              ? 'bg-indigo-100 text-indigo-700'
              : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'
          }`}
          title="Find in text"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          Find
        </button>
      </div>

      {/* Find bar */}
      {showFind && (
        <div className="px-3 py-1.5 border-b border-gray-100 bg-gray-50 shrink-0 flex items-center gap-2">
          <div className="flex items-center gap-1 border border-gray-200 rounded px-1.5 bg-white flex-1 max-w-xs">
            <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              ref={findInputRef}
              type="text"
              value={findQuery}
              onChange={e => { setFindQuery(e.target.value); setFindIndex(0); }}
              onKeyDown={handleFindKeyDown}
              placeholder="Find in text…"
              className="text-xs py-0.5 focus:outline-none bg-transparent flex-1 min-w-0"
            />
          </div>
          <span className="text-xs text-gray-400 shrink-0 w-16">
            {!findQuery.trim()
              ? ''
              : findMatches.length === 0
              ? 'No matches'
              : `${findIndex + 1} / ${findMatches.length}`}
          </span>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => stepFind(-1)}
              disabled={findMatches.length < 2}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-30 px-1.5 py-0.5 rounded hover:bg-gray-200 text-xs"
              title="Previous (Shift+Enter)"
            >↑</button>
            <button
              onClick={() => stepFind(1)}
              disabled={findMatches.length < 2}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-30 px-1.5 py-0.5 rounded hover:bg-gray-200 text-xs"
              title="Next (Enter)"
            >↓</button>
          </div>
          <button
            onClick={closeFind}
            className="text-gray-300 hover:text-gray-500 text-xs leading-none shrink-0"
            title="Close (Esc)"
          >✕</button>
        </div>
      )}

      <textarea
        ref={textareaRef}
        value={content}
        onChange={handleChange}
        placeholder="Begin writing here..."
        className="flex-1 w-full p-4 text-sm resize-none focus:outline-none border-none min-h-0"
        style={{ fontFamily: 'ui-monospace, "SF Mono", Consolas, monospace' }}
      />
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
