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
  // Open all links in the default browser instead of navigating the window
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

function registerIPC() {
  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Text Files', extensions: ['txt'] }],
    });
    if (result.canceled) return null;
    return result.filePaths[0];
  });

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

  ipcMain.handle('stage:getOutput', (event, { transcriptId, stage }) => {
    return queries.getStageOutput(transcriptId, stage);
  });

  ipcMain.handle('stage:saveOutput', (event, { transcriptId, stage, content }) => {
    try {
      queries.saveStageOutput(transcriptId, stage, content);
      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });

  ipcMain.handle('meaning-units:getAll', (event, transcriptId) => {
    return queries.getMeaningUnits(transcriptId);
  });

  ipcMain.handle('meaning-units:add', (event, { transcriptId, workflow }) => {
    return queries.addMeaningUnit(transcriptId, workflow);
  });

  ipcMain.handle('meaning-units:save', (event, mu) => {
    try {
      queries.saveMeaningUnit(mu);
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

  ipcMain.handle('export:corpus', async () => {
    const { formatCorpusStageOutputs, formatCorpusMeaningUnits } = require('./src/utils/exportFormatters');

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
      message: 'Select a folder to save the corpus export',
    });

    if (result.canceled) return { canceled: true };

    const dir = result.filePaths[0];

    try {
      const allStageOutputs = queries.getAllStageOutputsForCorpus();
      const allMeaningUnits = queries.getAllMeaningUnitsForCorpus();

      const stageCsv = formatCorpusStageOutputs(allStageOutputs);
      const muCsv = formatCorpusMeaningUnits(allMeaningUnits);

      fs.writeFileSync(path.join(dir, 'corpus_stage_outputs.csv'), stageCsv, 'utf-8');
      fs.writeFileSync(path.join(dir, 'corpus_meaning_units.csv'), muCsv, 'utf-8');

      return { success: true };
    } catch (err) {
      return { error: err.message };
    }
  });
}
