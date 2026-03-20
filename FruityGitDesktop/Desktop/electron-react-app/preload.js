const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');               // only what you really need
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
  // File dialogs
  openFlpDialog: () => ipcRenderer.invoke('open-flp-dialog'),
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),

  // File system (only safe operations)
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  // Zip extraction
  extractZip: (zipPath, extractTo) =>
    ipcRenderer.invoke('extract-zip', zipPath, extractTo),

  // Optional: expose path utilities if needed
  pathJoin: (...args) => path.join(...args),
  pathBasename: (p) => path.basename(p),

  runPythonProcessor: (filePath) => ipcRenderer.invoke('run-python-processor', filePath),

  // New: safe fs wrappers
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
  mkdir: (dirPath, options) => ipcRenderer.invoke('mkdir', dirPath, options),
  writeFile: (filePath, data) => ipcRenderer.invoke('write-file', filePath, data),
  dirIsEmpty: (dirPath) => ipcRenderer.invoke('dir-is-empty', dirPath),


  pathDirname: (p) => path.dirname(p),
  git: {
    checkInstalled: () => ipcRenderer.invoke('git:check-installed'),

    initOrOpen: (repoPath) =>
      ipcRenderer.invoke('git:init-or-open', { repoPath }),

    clone: (remoteUrl, localPath, auth = null) =>
      ipcRenderer.invoke('git:clone', { remoteUrl, localPath, auth }),

    status: (repoPath) =>
      ipcRenderer.invoke('git:status', { repoPath }),

    add: (repoPath, files) =>
      ipcRenderer.invoke('git:add', { repoPath, files }),

    commit: (repoPath, message, author = null) =>
      ipcRenderer.invoke('git:commit', { repoPath, message, author }),

    push: (repoPath, remote = 'origin', branch = 'main', auth = null) =>
      ipcRenderer.invoke('git:push', { repoPath, remote, branch, auth }),

    pull: (repoPath, remote = 'origin', branch = 'main', auth = null) =>
      ipcRenderer.invoke('git:pull', { repoPath, remote, branch, auth }),

    log: (repoPath, maxCount = 20) =>
      ipcRenderer.invoke('git:log', { repoPath, maxCount }),

    currentBranch: (repoPath) =>
      ipcRenderer.invoke('git:current-branch', { repoPath }),

    addRemote: (repoPath, remoteName, url) =>
      ipcRenderer.invoke('git:add-remote', { repoPath, remoteName, url }),

    getRemotes: (repoPath) =>
      ipcRenderer.invoke('git:get-remotes', { repoPath }),

    getOriginUrl: (repoPath) =>
      ipcRenderer.invoke('git:origin-url', { repoPath }),

    showNameStatus: (repoPath, commitHash) =>
      ipcRenderer.invoke('git:show-name-status', { repoPath, commitHash }),
  },

});