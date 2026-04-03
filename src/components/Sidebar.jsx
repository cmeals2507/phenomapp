import React, { useState, useEffect } from 'react';
import ImportModal from './ImportModal';
import DatabaseModal from './DatabaseModal';

const WORKFLOW = {
  human:   { short: 'H',  color: 'bg-blue-100 text-blue-700' },
  hybrid:  { short: 'HM', color: 'bg-purple-100 text-purple-700' },
  machine: { short: 'M',  color: 'bg-green-100 text-green-700' },
};

function CompletionDots({ count }) {
  return (
    <div className="flex gap-0.5 mt-0.5">
      {[0, 1, 2, 3, 4].map(i => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full ${i < count ? 'bg-indigo-500' : 'bg-gray-200'}`}
        />
      ))}
    </div>
  );
}

export default function Sidebar({ transcripts, selectedId, onSelectCase, onImport, onExportCorpus, onDbSwitch }) {
  const [showImport, setShowImport] = useState(false);
  const [showDb, setShowDb] = useState(false);
  const [dbFileName, setDbFileName] = useState('');
  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => {
    window.phenomAPI.dbGetPath().then(p => {
      if (p) setDbFileName(p.split('/').pop());
    });
  }, []);

  const handleContextMenu = (e, transcript) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, transcript });
  };

  return (
    <div
      className="flex flex-col bg-white border-r border-gray-200 shrink-0"
      style={{ width: 200 }}
      onClick={() => setContextMenu(null)}
    >
      <div className="p-3 border-b border-gray-200">
        <button
          onClick={() => setShowImport(true)}
          className="w-full text-sm bg-indigo-600 text-white rounded px-3 py-1.5 hover:bg-indigo-700 transition-colors"
        >
          + Import Transcript
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {transcripts.length === 0 ? (
          <p className="text-xs text-gray-400 p-3 text-center">No transcripts yet</p>
        ) : (
          transcripts.map(t => {
            const wf = WORKFLOW[t.workflow] || { short: '?', color: 'bg-gray-100 text-gray-600' };
            const isSelected = t.id === selectedId;
            return (
              <div
                key={t.id}
                onClick={() => onSelectCase(t.id)}
                onContextMenu={(e) => handleContextMenu(e, t)}
                className={`px-3 py-2 cursor-pointer border-l-2 ${
                  isSelected
                    ? 'bg-indigo-50 border-indigo-500'
                    : 'hover:bg-gray-50 border-transparent'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-medium text-gray-800 truncate">{t.participant_id}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${wf.color}`}>
                    {wf.short}
                  </span>
                </div>
                <CompletionDots count={t.completed_stages || 0} />
              </div>
            );
          })
        )}
      </div>

      <div className="p-3 border-t border-gray-200 space-y-1">
        <button
          onClick={onExportCorpus}
          className="w-full text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded px-2 py-1.5 transition-colors text-center"
        >
          Export All (Corpus)
        </button>
        <button
          onClick={() => setShowDb(true)}
          className="w-full text-left text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded px-2 py-1.5 transition-colors truncate"
          title={dbFileName}
        >
          DB: {dbFileName || '—'}
        </button>
      </div>

      {showDb && (
        <DatabaseModal
          onClose={() => setShowDb(false)}
          onSwitch={(newPath) => {
            setDbFileName(newPath.split('/').pop());
            setShowDb(false);
            onDbSwitch();
          }}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onSuccess={(newId) => {
            setShowImport(false);
            onImport(newId);
          }}
        />
      )}

      {contextMenu && (
        <div
          className="fixed bg-white border border-gray-200 rounded shadow-lg py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={async () => {
              await window.phenomAPI.exportSingleCase(contextMenu.transcript.id);
              setContextMenu(null);
            }}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Export Case...
          </button>
        </div>
      )}
    </div>
  );
}
