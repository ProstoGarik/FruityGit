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
    mainWindow.loadURL('http://localhost:3002');
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
  try {
    const extract = require('extract-zip');
    await extract(zipPath, { dir: extractPath });
    return { success: true };
  } catch (error) {
    console.error('ZIP extraction failed:', error);
    throw error;
  }
});

ipcMain.handle('open-folder-dialog', async () => {
  const { filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  return filePaths[0];
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

const ensureBinaryArchiveAttributes = (repoPath) => {
  const gitattributesPath = path.join(repoPath, '.gitattributes');
  const requiredRules = [
    '*.zip binary -text -diff -merge',
    '*.ZIP binary -text -diff -merge'
  ];

  let content = '';
  if (fs.existsSync(gitattributesPath)) {
    content = fs.readFileSync(gitattributesPath, 'utf8');
  }

  const lines = content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const missingRules = requiredRules.filter(rule => !lines.includes(rule));
  if (missingRules.length === 0) {
    return false;
  }

  const nextContent = content.length > 0 && !content.endsWith('\n')
    ? `${content}\n${missingRules.join('\n')}\n`
    : `${content}${missingRules.join('\n')}\n`;

  fs.writeFileSync(gitattributesPath, nextContent, 'utf8');
  return true;
};

const buildRemoteUrlWithAuth = (remoteUrl, auth) => {
  if (!remoteUrl || !auth) {
    return remoteUrl;
  }

  const protocol = remoteUrl.startsWith('https://') ? 'https://' : 'http://';
  const urlWithoutProtocol = remoteUrl.replace(/^https?:\/\//, '').replace(/^[^@]+@/, '');

  if (auth.username && auth.password) {
    return `${protocol}${encodeURIComponent(auth.username)}:${encodeURIComponent(auth.password)}@${urlWithoutProtocol}`;
  }

  if (auth.token) {
    // Token-only fallback: use token as HTTP password with a synthetic username.
    return `${protocol}oauth2:${encodeURIComponent(auth.token)}@${urlWithoutProtocol}`;
  }

  return remoteUrl;
};

const setRemoteUrlWithAuthIfNeeded = async (git, remoteName, auth) => {
  if (!auth || (!auth.token && !(auth.username && auth.password))) {
    return;
  }

  const remotes = await git.getRemotes(true);
  const targetRemote = remotes.find(r => r.name === remoteName);
  if (!targetRemote) {
    throw new Error(`Remote '${remoteName}' not found`);
  }

  const remoteUrl = targetRemote.refs.push || targetRemote.refs.fetch;
  const nextRemoteUrl = buildRemoteUrlWithAuth(remoteUrl, auth);
  if (!nextRemoteUrl || nextRemoteUrl === remoteUrl) {
    return;
  }

  await git.remote(['set-url', remoteName, nextRemoteUrl]);
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
    const rawStatus = await git.status();
    const status = {
      not_added: rawStatus.not_added ?? [],
      conflicted: rawStatus.conflicted ?? [],
      created: rawStatus.created ?? [],
      deleted: rawStatus.deleted ?? [],
      modified: rawStatus.modified ?? [],
      renamed: rawStatus.renamed ?? [],
      staged: rawStatus.staged ?? [],
      ahead: rawStatus.ahead ?? 0,
      behind: rawStatus.behind ?? 0,
      current: rawStatus.current ?? null,
      tracking: rawStatus.tracking ?? null,
      files: rawStatus.files ?? [],
      isClean: rawStatus.isClean()
    };
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
    const attributesUpdated = ensureBinaryArchiveAttributes(validatedPath);
    await git.add(files); // files can be string or array
    if (attributesUpdated) {
      await git.add('.gitattributes');
    }
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

    await setRemoteUrlWithAuthIfNeeded(git, remote, auth);

    const result = await git.push(remote, branch);
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Pull from remote
ipcMain.handle('git:pull', async (event, { repoPath, remote = 'origin', branch = 'main', auth }) => {
  try {
    const validatedPath = validateRepoPath(repoPath);
    const git = simpleGit(validatedPath);
    await setRemoteUrlWithAuthIfNeeded(git, remote, auth);
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

// Get added/deleted/modified file lists for a commit.
// Uses: git show --name-status --no-renames <hash>
ipcMain.handle('git:show-name-status', async (event, { repoPath, commitHash }) => {
  try {
    if (!commitHash) throw new Error('commitHash is required');
    const validatedPath = validateRepoPath(repoPath);
    const git = simpleGit(validatedPath);

    // We want a stable parse: one line per file change.
    // Example lines:
    // A\tpath/file.txt
    // D\tpath/file.txt
    // M\tpath/file.txt
    // R100\told/path\tnew/path (rename)
    const raw = await git.raw([
      'show',
      '--name-status',
      '--no-color',
      '--pretty=format:',
      commitHash
    ]);

    const addedFiles = [];
    const deletedFiles = [];
    const modifiedFiles = [];

    const lines = String(raw || '')
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      const parts = line.split('\t');
      const status = parts[0] || '';

      if (status === 'A') {
        const file = parts[1];
        if (file) addedFiles.push(file);
      } else if (status === 'D') {
        const file = parts[1];
        if (file) deletedFiles.push(file);
      } else if (status === 'M') {
        const file = parts[1];
        if (file) modifiedFiles.push(file);
      } else if (status.startsWith('R')) {
        // Rename: treat as delete + add for "added/deleted" info
        const oldFile = parts[1];
        const newFile = parts[2];
        if (oldFile) deletedFiles.push(oldFile);
        if (newFile) addedFiles.push(newFile);
      }
    }

    return { success: true, addedFiles, deletedFiles, modifiedFiles };
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

// Check if a directory exists and is empty.
// - If dir doesn't exist, treat it as empty (so caller can clone into it).
ipcMain.handle('dir-is-empty', (event, dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) return true;
    const entries = fs.readdirSync(dirPath);
    return entries.length === 0;
  } catch (error) {
    return false;
  }
});

// Read local git config and return origin URL (if present).
ipcMain.handle('git:origin-url', (event, { repoPath }) => {
  try {
    const configPath = path.join(repoPath, '.git', 'config');
    if (!fs.existsSync(configPath)) return null;

    const configText = fs.readFileSync(configPath, 'utf8');
    // Extract [remote "origin"] section and then its url = ...
    const originSection = configText.match(/\[remote "origin"\][\s\S]*?(?=\n\[|$)/m)?.[0];
    if (!originSection) return null;
    const urlMatch = originSection.match(/^\s*url\s*=\s*(.+)\s*$/m);
    return urlMatch?.[1]?.trim() ?? null;
  } catch (error) {
    return null;
  }
});