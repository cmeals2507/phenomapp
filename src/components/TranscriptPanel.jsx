import React, { useMemo } from 'react';

const WORKFLOW_LABELS = {
  human:   'Human-Only',
  hybrid:  'Human-Machine Hybrid',
  machine: 'Machine-Only',
};

export default function TranscriptPanel({ transcript, width, onExport }) {
  const wordCount = useMemo(() => {
    if (!transcript.raw_text) return 0;
    return transcript.raw_text.trim().split(/\s+/).filter(Boolean).length;
  }, [transcript.raw_text]);

  return (
    <div
      className="flex flex-col border-r border-gray-200 bg-white shrink-0"
      style={{ width: width ?? 380, minWidth: 200 }}
    >
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-semibold text-gray-800 text-sm">{transcript.participant_id}</h2>
          <p className="text-xs text-gray-500">
            {WORKFLOW_LABELS[transcript.workflow] || transcript.workflow}
          </p>
        </div>
        <button
          onClick={onExport}
          className="text-xs px-2 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded border border-gray-200"
        >
          Export
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
          {transcript.raw_text}
        </pre>
      </div>

      <div className="px-4 py-2 border-t border-gray-200 shrink-0">
        <p className="text-xs text-gray-400">{wordCount.toLocaleString()} words</p>
      </div>
    </div>
  );
}
