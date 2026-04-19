import React, { useState, useEffect, useRef, useCallback } from 'react';

export default function PositionalityModal({ onClose }) {
  const [text, setText] = useState('');
  const [createdAt, setCreatedAt] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const saveTimerRef = useRef(null);
  const textRef = useRef('');

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  useEffect(() => {
    async function load() {
      const data = await window.phenomAPI.getPositionality();
      if (data) {
        setText(data.text || '');
        setCreatedAt(data.created_at);
        setUpdatedAt(data.updated_at);
      }
    }
    load();
  }, []);

  const performSave = useCallback(async () => {
    try {
      const result = await window.phenomAPI.savePositionality(textRef.current);
      if (result?.created_at) setCreatedAt(result.created_at);
      if (result?.updated_at) setUpdatedAt(result.updated_at);
      setSaveError(false);
      setLastSavedTime(new Date().toLocaleTimeString());
      window.dispatchEvent(new CustomEvent('phenomapp:positionality-changed'));
    } catch {
      setSaveError(true);
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(performSave, 3000);
  }, [performSave]);

  const handleClose = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      await performSave();
    }
    onClose();
  }, [onClose, performSave]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleClose]);

  const formatTs = (iso) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 flex flex-col"
        style={{ maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Analyst Positionality Statement</h2>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed max-w-lg">
              Record your presuppositions, prior experiences, and interpretive orientation before engaging with transcripts. This record is attached to the current project database.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none ml-4 shrink-0 mt-0.5"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-6 py-4 min-h-0">
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); scheduleSave(); }}
            placeholder="Enter your positionality statement here..."
            className="w-full text-sm leading-relaxed p-3 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            style={{ minHeight: '300px' }}
            autoFocus
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 shrink-0 flex items-end justify-between gap-4">
          <div className="text-xs text-gray-400 space-y-0.5">
            {createdAt && <p>Created: {formatTs(createdAt)}</p>}
            {updatedAt && <p>Last edited: {formatTs(updatedAt)}</p>}
          </div>
          <p className={`text-xs shrink-0 ${saveError ? 'text-red-500' : 'text-gray-400'}`}>
            {saveError
              ? 'Save failed — check disk space'
              : lastSavedTime
              ? `Saved ${lastSavedTime}`
              : text
              ? 'Unsaved changes'
              : ''}
          </p>
        </div>
      </div>
    </div>
  );
}
