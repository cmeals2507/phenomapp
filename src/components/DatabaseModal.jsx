import React, { useState, useEffect } from 'react';

export default function DatabaseModal({ onClose, onSwitch }) {
  const [currentPath, setCurrentPath] = useState('');
  const [defaultPath, setDefaultPath] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      window.phenomAPI.dbGetPath(),
      window.phenomAPI.dbGetDefaultPath(),
    ]).then(([cur, def]) => {
      setCurrentPath(cur || '');
      setDefaultPath(def || '');
    });
  }, []);

  const fileName = currentPath ? currentPath.split('/').pop() : '';
  const isDefault = currentPath === defaultPath;

  const handle = async (action) => {
    setError('');
    const result = await action();
    if (!result || result.canceled) return;
    if (result.error) { setError(result.error); return; }
    onSwitch(result.path);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[440px] p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Database</h2>
        <p className="text-xs text-gray-500 mb-4">
          Switch databases to work with a different study or share a database file (e.g. via Dropbox).
          The app will reload after switching.
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-4">
          <p className="text-xs text-gray-500 mb-0.5">Currently open</p>
          <p className="text-sm font-medium text-gray-800 truncate" title={currentPath}>
            {fileName || '—'}
          </p>
          <p className="text-xs text-gray-400 truncate mt-0.5" title={currentPath}>
            {currentPath}
          </p>
          {isDefault && (
            <span className="inline-block mt-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
              Default location
            </span>
          )}
        </div>

        <div className="space-y-2">
          <button
            onClick={() => handle(window.phenomAPI.dbOpenExisting)}
            className="w-full text-left px-4 py-2.5 border border-gray-200 rounded hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-sm text-gray-700"
          >
            <span className="font-medium">Open existing database...</span>
            <span className="block text-xs text-gray-400 mt-0.5">Open a .db file from anywhere on your Mac</span>
          </button>

          <button
            onClick={() => handle(window.phenomAPI.dbCreateNew)}
            className="w-full text-left px-4 py-2.5 border border-gray-200 rounded hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-sm text-gray-700"
          >
            <span className="font-medium">Create new database...</span>
            <span className="block text-xs text-gray-400 mt-0.5">Start a fresh database at a location you choose</span>
          </button>

          {!isDefault && (
            <button
              onClick={() => handle(window.phenomAPI.dbUseDefault)}
              className="w-full text-left px-4 py-2.5 border border-gray-200 rounded hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-sm text-gray-700"
            >
              <span className="font-medium">Use default database</span>
              <span className="block text-xs text-gray-400 mt-0.5 truncate" title={defaultPath}>
                {defaultPath}
              </span>
            </button>
          )}
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 border border-gray-300 rounded hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
