import React from 'react';
import FreeformStage from './FreeformStage';
import MeaningUnitsStage from './MeaningUnitsStage';
import ProvisionalThemesStage from './ProvisionalThemesStage';

const STAGES = [
  { key: 'memo',          label: 'Holistic Memo',             index: 1 },
  { key: 'meaning_units', label: 'Meaning Units',             index: 2 },
  { key: 'themes',        label: 'Provisional Themes',        index: 3 },
  { key: 'whole_part',    label: 'Whole-Part Reconciliation', index: 4 },
  { key: 'essence',       label: 'Individual Essence',        index: 5 },
];

export default function StageArea({ transcript, openTabs, onTabClick }) {
  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0">
      <div className="flex items-center border-b border-gray-200 bg-white px-2 gap-1 shrink-0 overflow-x-auto">
        {STAGES.map(stage => {
          const isOpen = openTabs.includes(stage.key);
          return (
            <button
              key={stage.key}
              onClick={() => onTabClick(stage.key)}
              className={`px-3 py-2.5 text-xs whitespace-nowrap transition-colors border-b-2 ${
                isOpen
                  ? 'text-indigo-700 border-indigo-500 font-medium'
                  : 'text-gray-500 border-transparent hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              {stage.index}. {stage.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-1 min-h-0">
        {openTabs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <p className="text-sm">Click a stage tab to begin</p>
          </div>
        ) : (
          openTabs.map(tabKey => {
            const stage = STAGES.find(s => s.key === tabKey);
            return (
              <div
                key={`${transcript.id}-${tabKey}`}
                className={`flex flex-col min-h-0 border-r border-gray-100 last:border-r-0 ${
                  openTabs.length === 2 ? 'w-1/2' : 'flex-1'
                }`}
              >
                {tabKey === 'meaning_units' ? (
                  <MeaningUnitsStage transcript={transcript} />
                ) : tabKey === 'themes' ? (
                  <ProvisionalThemesStage transcript={transcript} />
                ) : (
                  <FreeformStage
                    transcript={transcript}
                    stage={tabKey}
                    stageLabel={`Stage ${stage.index}: ${stage.label}`}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
