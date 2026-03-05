const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');
const simpleGit = require('simple-git');

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

// Helper: Validate and normalize repo path
const validateRepoPath = (inputPath) => {
  const resolved = path.resolve(inputPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Path does not exist: ${resolved}`);
  }
  return resolved;
};

// Check if Git is installed and accessible
ipcMain.handle('git:check-installed', async () => {
  try {
    const git = simpleGit();
    await git.version();
    return { installed: true };
  } catch (error) {
    return {
      installed: false,
      message: 'Git is not installed or not in PATH. Please install Git to use local repository features.'
    };
  }
});

// Initialize or open a Git repository at a path
ipcMain.handle('git:init-or-open', async (event, { repoPath }) => {
  try {
    const validatedPath = validateRepoPath(repoPath);
    const git = simpleGit(validatedPath);

    // Check if already a repo, if not initialize
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      await git.init();
    }

    return { success: true, path: validatedPath, initialized: !isRepo };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Clone a remote repository
ipcMain.handle('git:clone', async (event, { remoteUrl, localPath, auth }) => {
  try {
    const validatedPath = path.resolve(localPath);
    const git = simpleGit();

    // Build clone options with auth if provided
    if (auth?.username && auth?.password) {
      // For HTTPS auth, embed credentials in URL (simple-git handles this)
      // Handle both http:// and https://
      const protocol = remoteUrl.startsWith('https://') ? 'https://' : 'http://';
      const urlWithoutProtocol = remoteUrl.replace(/^https?:\/\//, '');
      const urlWithAuth = `${protocol}${encodeURIComponent(auth.username)}:${encodeURIComponent(auth.password)}@${urlWithoutProtocol}`;
      await git.clone(urlWithAuth, validatedPath);
    } else {
      await git.clone(remoteUrl, validatedPath);
    }

    return { success: true, path: validatedPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get repository status
ipcMain.handle('git:status', async (event, { repoPath }) => {
  try {
    const validatedPath = validateRepoPath(repoPath);
    const git = simpleGit(validatedPath);
    const status = await git.status();
    return { success: true, status };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Add files to staging
ipcMain.handle('git:add', async (event, { repoPath, files }) => {
  try {
    const validatedPath = validateRepoPath(repoPath);
    const git = simpleGit(validatedPath);
    await git.add(files); // files can be string or array
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Commit changes
ipcMain.handle('git:commit', async (event, { repoPath, message, author }) => {
  try {
    const validatedPath = validateRepoPath(repoPath);
    const git = simpleGit(validatedPath);

    const commitOptions = {};
    if (author?.name && author?.email) {
      commitOptions['--author'] = `${author.name} <${author.email}>`;
    }

    const result = await git.commit(message, commitOptions);
    return { success: true, commit: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Push to remote
ipcMain.handle('git:push', async (event, { repoPath, remote = 'origin', branch = 'main', auth }) => {
  try {
    const validatedPath = validateRepoPath(repoPath);
    const git = simpleGit(validatedPath);

    // Get current remote URL and update with auth if needed
    if (auth?.username && auth?.password) {
      const remotes = await git.getRemotes(true);
      const originRemote = remotes.find(r => r.name === remote);
      if (originRemote) {
        let remoteUrl = originRemote.refs.fetch || originRemote.refs.push;
        // Update URL with credentials
        const protocol = remoteUrl.startsWith('https://') ? 'https://' : 'http://';
        const urlWithoutProtocol = remoteUrl.replace(/^https?:\/\//, '').replace(/^[^@]+@/, '');
        const urlWithAuth = `${protocol}${encodeURIComponent(auth.username)}:${encodeURIComponent(auth.password)}@${urlWithoutProtocol}`;
        
        // Update remote URL temporarily (or use environment variables)
        // For now, we'll use the URL with embedded credentials
        await git.removeRemote(remote);
        await git.addRemote(remote, urlWithAuth);
      }
    }

    const result = await git.push(remote, branch);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Pull from remote
ipcMain.handle('git:pull', async (event, { repoPath, remote = 'origin', branch = 'main' }) => {
  try {
    const validatedPath = validateRepoPath(repoPath);
    const git = simpleGit(validatedPath);
    const result = await git.pull(remote, branch);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get commit log/history
ipcMain.handle('git:log', async (event, { repoPath, maxCount = 20 }) => {
  try {
    const validatedPath = validateRepoPath(repoPath);
    const git = simpleGit(validatedPath);
    const log = await git.log({ maxCount });
    return { success: true, commits: log.all };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get current branch
ipcMain.handle('git:current-branch', async (event, { repoPath }) => {
  try {
    const validatedPath = validateRepoPath(repoPath);
    const git = simpleGit(validatedPath);
    const branch = await git.branch();
    return { success: true, current: branch.current, all: branch.all };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Add remote origin (if not set)
ipcMain.handle('git:add-remote', async (event, { repoPath, remoteName = 'origin', url }) => {
  try {
    const validatedPath = validateRepoPath(repoPath);
    const git = simpleGit(validatedPath);
    await git.addRemote(remoteName, url);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get remote URLs
ipcMain.handle('git:get-remotes', async (event, { repoPath }) => {
  try {
    const validatedPath = validateRepoPath(repoPath);
    const git = simpleGit(validatedPath);
    const remotes = await git.getRemotes(true);
    return { success: true, remotes };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// New: fs wrappers
ipcMain.handle('file-exists', (event, filePath) => fs.existsSync(filePath));
ipcMain.handle('mkdir', (event, dirPath, options) => fs.mkdirSync(dirPath, options));
ipcMain.handle('write-file', (event, filePath, data) => {
  const buffer = Buffer.from(data);
  fs.writeFileSync(filePath, buffer);
});
ipcMain.handle('unlink', (event, filePath) => fs.unlinkSync(filePath));