const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('phenomAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),

  getTranscripts: () => ipcRenderer.invoke('transcripts:getAll'),
  importTranscript: (data) => ipcRenderer.invoke('transcripts:import', data),
  getTranscript: (id) => ipcRenderer.invoke('transcripts:getOne', id),
  deleteTranscript: (id) => ipcRenderer.invoke('transcripts:delete', id),

  getStageOutput: (data) => ipcRenderer.invoke('stage:getOutput', data),
  saveStageOutput: (data) => ipcRenderer.invoke('stage:saveOutput', data),

  getMeaningUnits: (transcriptId) => ipcRenderer.invoke('meaning-units:getAll', transcriptId),
  addMeaningUnit: (data) => ipcRenderer.invoke('meaning-units:add', data),
  insertMeaningUnitAt: (data) => ipcRenderer.invoke('meaning-units:insertAt', data),
  saveMeaningUnit: (mu) => ipcRenderer.invoke('meaning-units:save', mu),
  saveMeaningUnitColor: (data) => ipcRenderer.invoke('meaning-units:saveColor', data),
  deleteMeaningUnit: (id) => ipcRenderer.invoke('meaning-units:delete', id),
  reorderMeaningUnits: (items) => ipcRenderer.invoke('meaning-units:reorder', items),

  getMeaningUnitExcerpts: (transcriptId) => ipcRenderer.invoke('meaning-units:getExcerpts', transcriptId),
  getHighlightData: (transcriptId) => ipcRenderer.invoke('meaning-units:getHighlightData', transcriptId),

  logMUReorder: (data) => ipcRenderer.invoke('meaning-units:logReorder', data),
  updateReorderLogNote: (data) => ipcRenderer.invoke('meaning-units:updateReorderNote', data),
  getReorderLog: (transcriptId) => ipcRenderer.invoke('meaning-units:getReorderLog', transcriptId),

  getMemoLinks: (transcriptId) => ipcRenderer.invoke('memo-links:getAll', transcriptId),
  addMemoLink: (data) => ipcRenderer.invoke('memo-links:add', data),
  deleteMemoLink: (id) => ipcRenderer.invoke('memo-links:delete', id),

  getPositionality: () => ipcRenderer.invoke('project:getPositionality'),
  savePositionality: (text) => ipcRenderer.invoke('project:savePositionality', text),

  exportSingleCase: (transcriptId) => ipcRenderer.invoke('export:singleCase', transcriptId),
  exportCorpus: () => ipcRenderer.invoke('export:corpus'),
  exportCorpusJson: () => ipcRenderer.invoke('export:corpusJson'),

  dbGetPath: () => ipcRenderer.invoke('db:getPath'),
  dbGetDefaultPath: () => ipcRenderer.invoke('db:getDefaultPath'),
  dbOpenExisting: () => ipcRenderer.invoke('db:openExisting'),
  dbCreateNew: () => ipcRenderer.invoke('db:createNew'),
  dbUseDefault: () => ipcRenderer.invoke('db:useDefault'),

  onFlushSaves: (callback) => ipcRenderer.on('app:flush-saves', callback),
});
