import React from 'react';

export default function Stage2Onboarding({ onDismiss }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
    >
      <div className="bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col"
           style={{ width: 480 }}>

        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base font-semibold text-gray-800">Earning the Highlight</span>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            In Stage 2, the blue transcript highlight for each meaning unit is{' '}
            <strong className="text-gray-800">earned</strong> — not automatic.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mt-3">
            To illuminate a meaning unit&rsquo;s excerpt in the transcript, you must first
            connect it to a passage in the Holistic Memo where that meaning first became
            visible to you. This keeps your segmentation grounded in your initial
            phenomenological encounter with the text.
          </p>
        </div>

        <div className="px-6 py-4 my-1 mx-6 rounded-md bg-gray-50 border border-gray-100">
          <p className="text-xs font-medium text-gray-600 mb-2">The indicator in the ID column:</p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-orange-400 shrink-0 inline-block"></span>
              <span className="text-xs text-gray-600">
                <strong>Orange</strong> — no memo link yet; transcript highlight is inactive
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-green-500 shrink-0 inline-block"></span>
              <span className="text-xs text-gray-600">
                <strong>Green</strong> — linked to the memo; transcript highlight is active
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Click any indicator to open the linking panel. You can link multiple memo passages
            to a single meaning unit, and a single passage can link to several units.
          </p>
        </div>

        <div className="px-6 pt-2 pb-5 flex justify-end">
          <button
            onClick={onDismiss}
            className="text-sm px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
          >
            Got it — start linking
          </button>
        </div>
      </div>
    </div>
  );
}
