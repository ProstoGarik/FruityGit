const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');

let mainWindow = null;

function createWindow() {
  console.log('Preload path:', path.join(__dirname, 'preload.js'));

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// IPC handlers (existing)
ipcMain.handle('extract-zip', async (event, zipPath, extractPath) => {
  return new Promise((resolve, reject) => {
    try {
      const extract = require('extract-zip');
      extract(zipPath, { dir: extractPath }, err => {
        if (err) reject(err);
        else resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
});

ipcMain.handle('open-save-dialog', async (event, options) => {
  const { filePath } = await dialog.showSaveDialog(options);
  return filePath;
});

ipcMain.handle('open-folder-dialog', async () => {
  const { filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return filePaths[0];
});

ipcMain.handle('show-message-box', async (event, options) => {
  const result = await dialog.showMessageBox(options);
  return result;
});

ipcMain.handle('open-flp-dialog', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'FL Studio Projects', extensions: ['flp'] }]
  });
  return filePaths[0];
});

ipcMain.handle('get-app-path', () => app.getAppPath());

ipcMain.handle('read-file', (event, filePath) => fs.readFileSync(filePath));

// New: Python processor handler
ipcMain.handle('run-python-processor', async (event, filePath) => {
  return new Promise((resolve, reject) => {
    const appPath = app.getAppPath();
    const pythonScriptPath = path.join(appPath, 'resources', 'python-app', 'dist', 'flp_processor.exe');

    if (!fs.existsSync(pythonScriptPath)) {
      return reject(new Error(`FLP processor not found at: ${pythonScriptPath}`));
    }

    const { spawn } = require('child_process');
    const pythonProcess = spawn(pythonScriptPath, [filePath]);

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log(`Python stdout: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(`Python stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        const zipPath = output.trim().split('\n').pop();
        if (zipPath && fs.existsSync(zipPath)) {
          resolve(zipPath);
        } else {
          reject(new Error('Failed to create ZIP file'));
        }
      } else {
        reject(new Error(`Python script failed: ${errorOutput}`));
      }
    });
  });
});

// New: fs wrappers
ipcMain.handle('file-exists', (event, filePath) => fs.existsSync(filePath));
ipcMain.handle('mkdir', (event, dirPath, options) => fs.mkdirSync(dirPath, options));
ipcMain.handle('write-file', (event, filePath, data) => {
  const buffer = Buffer.from(data);
  fs.writeFileSync(filePath, buffer);
});
ipcMain.handle('unlink', (event, filePath) => fs.unlinkSync(filePath));