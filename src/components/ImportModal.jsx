import React, { useState } from 'react';

const WORKFLOW_OPTIONS = [
  { value: 'human',   label: 'Human-Only' },
  { value: 'hybrid',  label: 'Human-Machine Hybrid' },
  { value: 'machine', label: 'Machine-Only' },
];

export default function ImportModal({ onClose, onSuccess }) {
  const [filePath, setFilePath] = useState('');
  const [fileName, setFileName] = useState('');
  const [participantId, setParticipantId] = useState('');
  const [workflow, setWorkflow] = useState('human');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePickFile = async () => {
    const path = await window.phenomAPI.openFile();
    if (path) {
      setFilePath(path);
      setFileName(path.split('/').pop());
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!filePath) { setError('Please select a file.'); return; }
    if (!participantId.trim()) { setError('Participant ID is required.'); return; }

    setLoading(true);
    setError('');

    const result = await window.phenomAPI.importTranscript({
      filePath,
      participantId: participantId.trim(),
      workflow,
    });

    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      onSuccess(result.id);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-96 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Import Transcript</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transcript File (.txt)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={fileName}
                readOnly
                placeholder="No file selected"
                className="flex-1 text-sm border border-gray-300 rounded px-3 py-1.5 bg-gray-50 text-gray-600"
              />
              <button
                type="button"
                onClick={handlePickFile}
                className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-100"
              >
                Browse
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Participant ID
            </label>
            <input
              type="text"
              value={participantId}
              onChange={e => setParticipantId(e.target.value)}
              placeholder="e.g., P1"
              className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Workflow Condition
            </label>
            <select
              value={workflow}
              onChange={e => setWorkflow(e.target.value)}
              className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {WORKFLOW_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 text-sm px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 text-sm px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Importing...' : 'Import'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
