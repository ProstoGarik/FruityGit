const { app, BrowserWindow } = require('electron');
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
}

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