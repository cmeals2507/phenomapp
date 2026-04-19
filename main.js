const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = !!process.env.VITE_DEV_SERVER_URL;

let mainWindow;
let queries;
let isClosing = false;
let currentDb = null;
let currentDbPath = null;

function getDefaultDbPath() {
  return path.join(app.getPath('userData'), 'phenomapp.db');
}

function loadSettings() {
  try {
    const raw = fs.readFileSync(path.join(app.getPath('userData'), 'settings.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  fs.writeFileSync(
    path.join(app.getPath('userData'), 'settings.json'),
    JSON.stringify(settings, null, 2),
    'utf-8'
  );
}

function openDatabase(filePath) {
  if (currentDb) {
    try { currentDb.close(); } catch {}
  }
  const Database = require('better-sqlite3');
  const { initSchema } = require('./src/db/schema');
  currentDb = new Database(filePath);
  initSchema(currentDb);
  queries.setDb(currentDb);
  currentDbPath = filePath;
}

function createAboutWindow() {
  const win = new BrowserWindow({
    width: 420,
    height: 250,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'About PhenomApp',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  win.setMenu(null);
  win.loadFile(path.join(__dirname, 'about.html'));
  win.webContents.on('will-navigate', (e, url) => {
    e.preventDefault();
    shell.openExternal(url);
  });
}

function buildMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { label: `About ${app.name}`, click: () => createAboutWindow() },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.on('close', (e) => {
    if (!isClosing) {
      e.preventDefault();
      mainWindow.webContents.send('app:flush-saves');
      setTimeout(() => {
        isClosing = true;
        mainWindow.close();
      }, 800);
    }
  });
}

app.whenReady().then(() => {
  queries = require('./src/db/queries');

  const settings = loadSettings();
  const initialPath = (settings.dbPath && fs.existsSync(settings.dbPath))
    ? settings.dbPath
    : getDefaultDbPath();
  openDatabase(initialPath);

  createWindow();
  buildMenu();
  registerIPC();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nowParts() {
  const now = new Date();
  const date = now.getFullYear() +
    '-' + String(now.getMonth() + 1).padStart(2, '0') +
    '-' + String(now.getDate()).padStart(2, '0');
  const time = String(now.getHours()).padStart(2, '0') +
    ':' + String(now.getMinutes()).padStart(2, '0') +
    ':' + String(now.getSeconds()).padStart(2, '0');
  return { date, time };
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

function registerIPC() {
  const { updateDayStamps } = require('./src/utils/timestamps');

  // --- File dialogs ---

  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Text Files', extensions: ['txt'] }],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

  // --- Transcripts ---

  ipcMain.handle('transcripts:getAll', () => {
    return queries.getAllTranscripts();
  });

  ipcMain.handle('transcripts:import', (event, { filePath, participantId, workflow }) => {
    try {
      const rawText = fs.readFileSync(filePath, 'utf-8');
      if (!rawText.trim()) {
        return { error: 'File is empty or contains only whitespace.' };
      }
      const result = queries.importTranscript({ participantId, workflow, rawText });
      return { success: true, id: result.id };
    } catch (err) {
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        return { error: `A transcript for "${participantId}" with workflow "${workflow}" already exists.` };
      }
      return { error: err.message };
    }
  });

  ipcMain.handle('transcripts:getOne', (event, transcriptId) => {
    return queries.getTranscript(transcriptId);
  });

  ipcMain.handle('transcripts:delete', (event, id) => {
    try {
      queries.deleteTranscript(id);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  // --- Stage outputs ---

  ipcMain.handle('stage:getOutput', (event, { transcriptId, stage }) => {
    return queries.getStageOutput(transcriptId, stage);
  });

  ipcMain.handle('stage:saveOutput', (event, { transcriptId, stage, content }) => {
    try {
      const existing = queries.getStageOutput(transcriptId, stage);
      const { date, time } = nowParts();
      const dayStamps = updateDayStamps(existing?.day_stamps, date, time);
      queries.saveStageOutput(transcriptId, stage, content, dayStamps);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  // --- Meaning units ---

  ipcMain.handle('meaning-units:getAll', (event, transcriptId) => {
    return queries.getMeaningUnits(transcriptId);
  });

  ipcMain.handle('meaning-units:add', (event, { transcriptId, workflow }) => {
    const { date, time } = nowParts();
    const initialDayStamps = JSON.stringify([{ date, first_edited_at: time }]);
    return queries.addMeaningUnit(transcriptId, workflow, initialDayStamps);
  });

  ipcMain.handle('meaning-units:insertAt', (event, { transcriptId, workflow, insertAtOrder }) => {
    const { date, time } = nowParts();
    const initialDayStamps = JSON.stringify([{ date, first_edited_at: time }]);
    return queries.insertMeaningUnit(transcriptId, workflow, initialDayStamps, insertAtOrder);
  });

  ipcMain.handle('meaning-units:getExcerpts', (event, transcriptId) => {
    return queries.getMeaningUnitExcerpts(transcriptId);
  });

  ipcMain.handle('meaning-units:save', (event, mu) => {
    try {
      const existing = queries.getMeaningUnitById(mu.id);
      const { date, time } = nowParts();
      const dayStamps = updateDayStamps(existing?.day_stamps, date, time);
      queries.saveMeaningUnit({ ...mu, day_stamps: dayStamps });
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  // Immediate color save — does NOT update day_stamps (structural tag, not text entry).
  ipcMain.handle('meaning-units:saveColor', (event, { id, theme_color }) => {
    try {
      queries.saveMeaningUnitColor({ id, theme_color });
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('meaning-units:delete', (event, id) => {
    queries.deleteMeaningUnit(id);
    return { success: true };
  });

  ipcMain.handle('meaning-units:reorder', (event, items) => {
    queries.reorderMeaningUnits(items);
    return { success: true };
  });

  ipcMain.handle('meaning-units:getHighlightData', (event, transcriptId) => {
    return queries.getHighlightData(transcriptId);
  });

  ipcMain.handle('meaning-units:logReorder', (event, { transcriptId, reorderedAt, orderSnapshot }) => {
    try {
      const id = queries.logMUReorder({ transcriptId, reorderedAt, orderSnapshot });
      return { success: true, id };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('meaning-units:updateReorderNote', (event, { id, note }) => {
    try {
      queries.updateReorderLogNote({ id, note });
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('meaning-units:getReorderLog', (event, transcriptId) => {
    return queries.getReorderLog(transcriptId);
  });

  // --- Project meta ---

  ipcMain.handle('project:getPositionality', () => {
    return queries.getPositionality();
  });

  ipcMain.handle('project:savePositionality', (event, text) => {
    try {
      const now = new Date().toISOString();
      queries.savePositionality(text, now);
      return { success: true, ...queries.getPositionality() };
    } catch (err) {
      return { error: err.message };
    }
  });

  // --- Export ---

  ipcMain.handle('export:singleCase', async (event, transcriptId) => {
    const { formatSingleCase } = require('./src/utils/exportFormatters');

    const transcript = queries.getTranscript(transcriptId);
    const stageOutputs = queries.getAllStageOutputs(transcriptId);
    const meaningUnits = queries.getMeaningUnits(transcriptId);

    const content = formatSingleCase(transcript, stageOutputs, meaningUnits);

    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `${transcript.participant_id}_${transcript.workflow}_export.txt`,
      filters: [{ name: 'Text Files', extensions: ['txt'] }],
    });

    if (result.canceled) return { canceled: true };

    try {
      fs.writeFileSync(result.filePath, content, 'utf-8');
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('export:corpus', async () => {
    const { formatCorpusStageOutputs, formatCorpusMeaningUnits, formatCorpusReorderLog, formatPositionality } = require('./src/utils/exportFormatters');

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      message: 'Select a folder to save the corpus export',
    });

    if (result.canceled) return { canceled: true };

    const dir = result.filePaths[0];

    try {
      const allStageOutputs = queries.getAllStageOutputsForCorpus();
      const allMeaningUnits = queries.getAllMeaningUnitsForCorpus();
      const allReorderLogs = queries.getAllReorderLogsForCorpus();
      const positionality = queries.getPositionality();

      fs.writeFileSync(path.join(dir, 'corpus_stage_outputs.csv'), formatCorpusStageOutputs(allStageOutputs), 'utf-8');
      fs.writeFileSync(path.join(dir, 'corpus_meaning_units.csv'), formatCorpusMeaningUnits(allMeaningUnits), 'utf-8');
      fs.writeFileSync(path.join(dir, 'reorder_log.csv'), formatCorpusReorderLog(allReorderLogs), 'utf-8');
      fs.writeFileSync(path.join(dir, 'positionality.txt'), formatPositionality(positionality, currentDbPath), 'utf-8');

      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  // --- Database ---

  ipcMain.handle('db:getPath', () => currentDbPath);
  ipcMain.handle('db:getDefaultPath', () => getDefaultDbPath());

  ipcMain.handle('db:openExisting', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Database Files', extensions: ['db', 'sqlite', 'sqlite3'] }],
      message: 'Open an existing PhenomApp database',
    });
    if (result.canceled) return { canceled: true };
    try {
      openDatabase(result.filePaths[0]);
      saveSettings({ dbPath: result.filePaths[0] });
      return { success: true, path: result.filePaths[0] };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('db:createNew', async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'phenomapp.db',
      filters: [{ name: 'Database Files', extensions: ['db'] }],
      message: 'Create a new PhenomApp database',
    });
    if (result.canceled) return { canceled: true };
    try {
      openDatabase(result.filePath);
      saveSettings({ dbPath: result.filePath });
      return { success: true, path: result.filePath };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('db:useDefault', () => {
    try {
      const defaultPath = getDefaultDbPath();
      openDatabase(defaultPath);
      saveSettings({ dbPath: defaultPath });
      return { success: true, path: defaultPath };
    } catch (err) {
      return { error: err.message };
    }
  });
}
