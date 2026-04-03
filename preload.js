const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('phenomAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),

  getTranscripts: () => ipcRenderer.invoke('transcripts:getAll'),
  importTranscript: (data) => ipcRenderer.invoke('transcripts:import', data),
  getTranscript: (id) => ipcRenderer.invoke('transcripts:getOne', id),

  getStageOutput: (data) => ipcRenderer.invoke('stage:getOutput', data),
  saveStageOutput: (data) => ipcRenderer.invoke('stage:saveOutput', data),

  getMeaningUnits: (transcriptId) => ipcRenderer.invoke('meaning-units:getAll', transcriptId),
  addMeaningUnit: (data) => ipcRenderer.invoke('meaning-units:add', data),
  saveMeaningUnit: (mu) => ipcRenderer.invoke('meaning-units:save', mu),
  deleteMeaningUnit: (id) => ipcRenderer.invoke('meaning-units:delete', id),
  reorderMeaningUnits: (items) => ipcRenderer.invoke('meaning-units:reorder', items),

  exportSingleCase: (transcriptId) => ipcRenderer.invoke('export:singleCase', transcriptId),
  exportCorpus: () => ipcRenderer.invoke('export:corpus'),

  dbGetPath: () => ipcRenderer.invoke('db:getPath'),
  dbGetDefaultPath: () => ipcRenderer.invoke('db:getDefaultPath'),
  dbOpenExisting: () => ipcRenderer.invoke('db:openExisting'),
  dbCreateNew: () => ipcRenderer.invoke('db:createNew'),
  dbUseDefault: () => ipcRenderer.invoke('db:useDefault'),

  onFlushSaves: (callback) => ipcRenderer.on('app:flush-saves', callback),
});
