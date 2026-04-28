import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import TranscriptPanel from './components/TranscriptPanel';
import StageArea from './components/StageArea';

function ResizeDivider({ onMouseDown }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="shrink-0 bg-gray-200 hover:bg-indigo-400 cursor-col-resize transition-colors"
      style={{ width: 4 }}
    />
  );
}

export default function App() {
  const [transcripts, setTranscripts] = useState([]);
  const [selectedTranscript, setSelectedTranscript] = useState(null);
  const [openTabs, setOpenTabs] = useState([]);
  const [transcriptWidth, setTranscriptWidth] = useState(380);

  const resizeState = useRef({ active: false, startX: 0, startWidth: 0 });

  // Resize mouse events
  useEffect(() => {
    const onMove = (e) => {
      if (!resizeState.current.active) return;
      const delta = e.clientX - resizeState.current.startX;
      setTranscriptWidth(Math.max(200, Math.min(700, resizeState.current.startWidth + delta)));
    };
    const onUp = () => {
      resizeState.current.active = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const handleResizeMouseDown = useCallback((e) => {
    resizeState.current = { active: true, startX: e.clientX, startWidth: transcriptWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [transcriptWidth]);

  const loadTranscripts = useCallback(async () => {
    const list = await window.phenomAPI.getTranscripts();
    setTranscripts(list);
  }, []);

  useEffect(() => {
    loadTranscripts();
  }, [loadTranscripts]);

  const handleSelectCase = useCallback(async (id) => {
    setOpenTabs([]);
    const transcript = await window.phenomAPI.getTranscript(id);
    setSelectedTranscript(transcript);
  }, []);

  const handleImport = useCallback(async (newId) => {
    await loadTranscripts();
    if (newId) handleSelectCase(newId);
  }, [loadTranscripts, handleSelectCase]);

  const handleDelete = useCallback(async (id) => {
    await window.phenomAPI.deleteTranscript(id);
    setSelectedTranscript(null);
    setOpenTabs([]);
    await loadTranscripts();
  }, [loadTranscripts]);

  const handleDbSwitch = useCallback(async () => {
    setSelectedTranscript(null);
    setOpenTabs([]);
    await loadTranscripts();
  }, [loadTranscripts]);

  const handleTabClick = useCallback((tabKey) => {
    setOpenTabs(prev => {
      if (prev.includes(tabKey)) {
        return prev.filter(t => t !== tabKey);
      } else if (prev.length < 2) {
        return [...prev, tabKey];
      } else {
        return [prev[1], tabKey];
      }
    });
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden w-full">
      <Sidebar
        transcripts={transcripts}
        selectedId={selectedTranscript?.id}
        onSelectCase={handleSelectCase}
        onImport={handleImport}
        onDelete={handleDelete}
        onExportCorpus={() => window.phenomAPI.exportCorpus()}
        onExportCorpusJson={() => window.phenomAPI.exportCorpusJson()}
        onDbSwitch={handleDbSwitch}
      />
      {selectedTranscript ? (
        <>
          <TranscriptPanel
            transcript={selectedTranscript}
            width={transcriptWidth}
            onExport={() => window.phenomAPI.exportSingleCase(selectedTranscript.id)}
            showCoverage={openTabs.includes('meaning_units')}
          />
          <ResizeDivider onMouseDown={handleResizeMouseDown} />
          <StageArea
            transcript={selectedTranscript}
            openTabs={openTabs}
            onTabClick={handleTabClick}
          />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <p className="text-lg">No case selected</p>
            <p className="text-sm mt-1">Import a transcript or select a case from the sidebar</p>
          </div>
        </div>
      )}
    </div>
  );
}
