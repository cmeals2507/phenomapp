import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAutoSave } from '../utils/autoSave';

export default function FreeformStage({ transcript, stage, stageLabel }) {
  const [content, setContent] = useState('');
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [saveError, setSaveError] = useState(false);
  const contentRef = useRef('');

  const performSave = useCallback(async (value) => {
    try {
      await window.phenomAPI.saveStageOutput({
        transcriptId: transcript.id,
        stage,
        content: value,
      });
      setSaveError(false);
      setLastSavedTime(new Date().toLocaleTimeString());
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

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 shrink-0">
        <span className="text-xs font-medium text-gray-600">{stageLabel}</span>
      </div>
      <textarea
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
