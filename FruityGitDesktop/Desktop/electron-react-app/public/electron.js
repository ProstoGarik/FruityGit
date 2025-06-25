const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');


const { execFile } = require('child_process');



function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  // Загрузка React-приложения
  win.loadURL(
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../build/index.html')}`
  );

  // Открытие DevTools в режиме разработки
  if (process.env.NODE_ENV === 'development') {
    win.webContents.openDevTools();
  }

  // Add IPC handler for opening .flp file dialog
  ipcMain.handle('open-flp-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Выберите .flp файл',
      filters: [
        { name: 'FL Studio Project', extensions: ['flp'] }
      ],
      properties: ['openFile']
    });
    if (canceled) return null;
    return filePaths[0];
  });
}

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const fs = require('fs').promises;
    const content = await fs.readFile(filePath);
    return content;
  } catch (error) {
    console.error('Error reading file:', error);
    return null;
  }
});

ipcMain.handle('get-app-path', () => {
  return app.getAppPath();
});

ipcMain.handle('open-save-dialog', async (event, options) => {
  const { filePath } = await dialog.showSaveDialog(options);
  return filePath;
});

ipcMain.handle('open-folder-dialog', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return filePaths[0];
});

// In your main electron process file (main.js)
ipcMain.handle('show-message-box', async (event, options) => {
  const result = await dialog.showMessageBox(options);
  return result;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Добавляем обработку закрытия окна
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Обработка глубоких ссылок (для возможной future интеграции)
app.on('open-url', (event, url) => {
  event.preventDefault()
  // Обработка URL, например для OAuth
})

// Обработка второго экземпляра приложения
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Фокус на существующее окно
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}