import React from 'react';

export default function Stage3Onboarding({ onDismiss }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
    >
      <div className="bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col"
           style={{ width: 480 }}>

        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base font-semibold text-gray-800">Earning the Theme Highlight</span>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed">
            In Stage 3, the colored theme highlight in the transcript is{' '}
            <strong className="text-gray-800">earned</strong> — not automatic.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mt-3">
            Both a <strong className="text-gray-800">provisional theme</strong> name and a{' '}
            <strong className="text-gray-800">thematic interpretation</strong> are required before
            a meaning unit&rsquo;s excerpt is rendered in color in the transcript. Setting a
            theme label alone is not enough — the highlight activates only once you&rsquo;ve
            articulated what that theme reveals about the phenomenon.
          </p>
          <p className="text-sm text-gray-600 leading-relaxed mt-3">
            This ensures every colored segment in the transcript reflects genuine interpretive
            work, not just preliminary labeling.
          </p>
        </div>

        <div className="px-6 py-4 my-1 mx-6 rounded-md bg-gray-50 border border-gray-100">
          <p className="text-xs font-medium text-gray-600 mb-2">What activates the highlight:</p>
          <div className="flex flex-col gap-2">
            <div className="flex items-start gap-3">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1 inline-block"></span>
              <span className="text-xs text-gray-600">
                <strong>Provisional theme</strong> + <strong>theme color</strong> assigned
              </span>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0 mt-1 inline-block"></span>
              <span className="text-xs text-gray-600">
                <strong>Thematic interpretation</strong> written (even briefly)
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            The amber dot next to incomplete rows indicates the interpretation is still needed.
            Once both conditions are met, the excerpt illuminates in the transcript automatically.
          </p>
        </div>

        <div className="px-6 pt-2 pb-5 flex justify-end">
          <button
            onClick={onDismiss}
            className="text-sm px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
          >
            Got it — begin theming
          </button>
        </div>
      </div>
    </div>
  );
}
