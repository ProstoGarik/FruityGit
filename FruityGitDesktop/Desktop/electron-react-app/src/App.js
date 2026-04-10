// src/App.js

import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import LoginWindow from './Login/Login';
import { GitService } from './Git/GitService';
import CreateRepo from './Repo/CreateRepo';
import RepoPicker from './Repo/RepoPicker';
import SettingsWindow from './Settings/Settings';
import {
  getAccessToken,
  refreshAuthToken,
  fetchWithGitea,
  getGiteaToken
} from './Login/AuthService';

function App() {
  const [repoName, setRepoName] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [repos, setRepos] = useState([]);
  const [commits, setCommits] = useState([]);
  const [selectedCommit, setSelectedCommit] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  // Single backend (auth + metadata API) - ASP.NET server on port 3000 (also proxies Gitea)
  const [serverPath, setServerPath] = useState(() => localStorage.getItem('serverPath') || 'http://localhost:3000');
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [localRepoPath, setLocalRepoPath] = useState(null);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [processWithPython, setProcessWithPython] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [user, setUser] = useState(null);
  const [showCreateRepo, setShowCreateRepo] = useState(false);
  const [repoPathMap, setRepoPathMap] = useState({}); // NEW: stores { remoteRepoName: localPath }
  const [gitError, setGitError] = useState(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [allowUserEmail, setAllowUserEmail] = useState('');
  const [isAllowingUser, setIsAllowingUser] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPluginsInDetails, setShowPluginsInDetails] = useState(false);
  const [showRepoPicker, setShowRepoPicker] = useState(false);
  const [isFlpProcessing, setIsFlpProcessing] = useState(false);
  const [flpProcessingMessage, setFlpProcessingMessage] = useState('');
  const [localAheadCount, setLocalAheadCount] = useState(0);


  const normalizeCloneUrl = (cloneUrl) => {
    if (!cloneUrl) return cloneUrl;
    try {
      const clone = new URL(cloneUrl);
      const server = new URL(serverPath);
      const normalizedPath = clone.pathname.startsWith('/gitea/')
        ? clone.pathname
        : `/gitea${clone.pathname.startsWith('/') ? clone.pathname : `/${clone.pathname}`}`;
      return `${server.origin}${normalizedPath}`;
    } catch (error) {
      console.warn('Failed to normalize clone URL:', cloneUrl, error);
      return cloneUrl;
    }
  };

  const parseRepoRef = (repoRef, fallbackOwner = null) => {
    if (!repoRef) return { owner: fallbackOwner, name: null, fullName: null };
    if (repoRef.includes('/')) {
      const [owner, ...nameParts] = repoRef.split('/');
      const name = nameParts.join('/');
      return { owner, name, fullName: `${owner}/${name}` };
    }
    return {
      owner: fallbackOwner,
      name: repoRef,
      fullName: fallbackOwner ? `${fallbackOwner}/${repoRef}` : repoRef
    };
  };

  const isGitRepositoryPath = async (candidatePath) => {
    if (!candidatePath) return false;
    const dotGitPath = window.electronAPI.pathJoin(candidatePath, '.git');
    return await window.electronAPI.fileExists(dotGitPath);
  };

  const extractOwnerRepoFromRemoteUrl = (remoteUrl) => {
    if (!remoteUrl || typeof remoteUrl !== 'string') return null;

    // Remove query/hash and credentials/userinfo.
    const cleaned = remoteUrl.split('?')[0].split('#')[0];
    const withoutAuth = cleaned.includes('@') ? cleaned.split('@').pop() : cleaned;

    // Prefer matching last two path segments (owner/repo(.git)).
    const lastTwoMatch = withoutAuth.match(/\/([^/]+)\/([^/]+?)(?:\.git)?$/i);
    if (lastTwoMatch) {
      return { owner: lastTwoMatch[1], repo: lastTwoMatch[2] };
    }

    // Fallback for ssh-like: git@host:owner/repo.git
    const sshMatch = withoutAuth.match(/[:/]([^:/\s]+)\/([^/\s]+?)(?:\.git)?$/i);
    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2] };
    }

    return null;
  };

  const ensureLocalRepoMatchesSelected = async (localRepoPath, expectedOwner, expectedRepo) => {
    const originUrl = await window.electronAPI.git.getOriginUrl(localRepoPath);
    const parsed = extractOwnerRepoFromRemoteUrl(originUrl);
    if (!parsed) {
      throw new Error('Не удалось определить удалённый репозиторий для локальной папки. Выберите корректную папку.');
    }

    const ownerOk = String(parsed.owner).toLowerCase() === String(expectedOwner).toLowerCase();
    const repoOk = String(parsed.repo).toLowerCase() === String(expectedRepo).toLowerCase();
    if (!ownerOk || !repoOk) {
      throw new Error(`Selected folder is a git repository for ${parsed.owner}/${parsed.repo}, but you selected ${expectedOwner}/${expectedRepo}.`);
    }
  };

  const ensureLocalRepoFor = async (repoRef, ownerName) => {
    const { owner, name: repo, fullName } = parseRepoRef(repoRef, ownerName);
    if (!repo || !owner) {
      throw new Error('Некорректная ссылка на репозиторий');
    }

    const mappedPath = repoPathMap[fullName] || repoPathMap[repo];
    if (mappedPath && await isGitRepositoryPath(mappedPath)) {
      return mappedPath;
    }

    const selectedFolder = await window.electronAPI.openFolderDialog();
    if (!selectedFolder) {
      return null;
    }

    const candidateSelfRepoPath = selectedFolder;
    const candidateSubRepoPath = window.electronAPI.pathJoin(selectedFolder, repo);

    // Case 1/2: chosen folder already contains a git repo (self or selectedFolder/<repo>)
    if (await isGitRepositoryPath(candidateSelfRepoPath)) {
      await ensureLocalRepoMatchesSelected(candidateSelfRepoPath, owner, repo);
      await GitService.pullFromServer(candidateSelfRepoPath, 'main');
      setRepoPathMap(prev => ({ ...prev, [repo]: candidateSelfRepoPath, [fullName]: candidateSelfRepoPath }));
      setLocalRepoPath(candidateSelfRepoPath);
      return candidateSelfRepoPath;
    }

    if (await isGitRepositoryPath(candidateSubRepoPath)) {
      await ensureLocalRepoMatchesSelected(candidateSubRepoPath, owner, repo);
      await GitService.pullFromServer(candidateSubRepoPath, 'main');
      setRepoPathMap(prev => ({ ...prev, [repo]: candidateSubRepoPath, [fullName]: candidateSubRepoPath }));
      setLocalRepoPath(candidateSubRepoPath);
      return candidateSubRepoPath;
    }

    // Case 3: target repo directory is empty -> clone
    const cloneTargetPath = candidateSubRepoPath;
    const isEmpty = await window.electronAPI.dirIsEmpty(cloneTargetPath);
    if (!isEmpty) {
      throw new Error('Выбранная папка не пустая и не содержит git-репозиторий этого проекта.');
    }

    const repoInfo = await getRepoInfo(owner, repo);
    const giteaRepoUrl = normalizeCloneUrl(repoInfo.clone_url);
    await GitService.cloneRepo(giteaRepoUrl, cloneTargetPath, user);

    setRepoPathMap(prev => ({ ...prev, [repo]: cloneTargetPath, [fullName]: cloneTargetPath }));
    setLocalRepoPath(cloneTargetPath);
    return cloneTargetPath;
  };



  const getRepoInfo = async (owner, repo) => {
    const response = await fetchWithGitea(`${serverPath}/gitea/api/v1/repos/${owner}/${repo}`, { method: 'GET' });
    if (!response.ok) throw new Error('Не удалось получить информацию о репозитории');
    return response.json();
  };

  const fetchWithTimeout = async (url, options = {}, timeoutMs = 8000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  const handleLogin = () => {
    setShowLogin(true);
  };

  const handleCloseLogin = (userData) => {
    setShowLogin(false);
    if (userData) {
      setUser(userData);
      // Optionally store in localStorage for persistence
      localStorage.setItem('user', JSON.stringify(userData));
    }
  };

  const handleAttachFile = async () => {
    console.log('window.electronAPI exists?', !!window.electronAPI);
    console.log('window.electronAPI keys:', window.electronAPI ? Object.keys(window.electronAPI) : 'undefined');

    try {
      if (!user) {
        alert('Сначала выполните вход');
        return;
      }

      if (!selectedRepo) {
        alert('Сначала выберите репозиторий');
        return;
      }

      const filePath = await window.electronAPI.openFlpDialog();
      if (!filePath) return;

      setIsFlpProcessing(true);
      setFlpProcessingMessage(
        processWithPython
          ? 'Обработка FLP… Это может занять некоторое время. Пожалуйста, подождите.'
          : 'Копирование файла в репозиторий…'
      );

      const stageFileInLocalRepo = async (sourcePath, localPath) => {
        const fileContent = await window.electronAPI.readFile(sourcePath);
        if (!fileContent) {
          throw new Error('Не удалось прочитать файл');
        }

        const fileName = sourcePath.split(/[\\/]/).pop();
        const destinationPath = window.electronAPI.pathJoin(localPath, 'uploads', fileName);
        await window.electronAPI.mkdir(window.electronAPI.pathDirname(destinationPath), { recursive: true });
        await window.electronAPI.writeFile(destinationPath, fileContent);

        const addResult = await window.electronAPI.git.add(localPath, destinationPath);
        if (!addResult.success) {
          throw new Error(addResult.error || 'Не удалось добавить файл в индекс');
        }

        return destinationPath;
      };

      if (processWithPython) {
        // Call IPC to run Python in main
        const zipPath = await window.electronAPI.runPythonProcessor(filePath);
        setFlpProcessingMessage('Распаковка архива и подготовка файлов в репозитории…');
        const localPath = await ensureLocalRepoFor(selectedRepo, user.name);
        if (!localPath) {
          alert('Выберите папку для клонирования репозитория');
          return;
        }

        // Extract ZIP into the repo and stage extracted contents (not the ZIP file)
        const zipBaseName = window.electronAPI.pathBasename(zipPath).replace(/\.zip$/i, '');
        // Use a stable folder per FLP to avoid re-adding the whole tree each upload.
        // This allows git to show only real added/deleted/modified files.
        const extractTo = window.electronAPI.pathJoin(localPath, 'uploads', zipBaseName);
        const uploadsRoot = window.electronAPI.pathJoin(localPath, 'uploads');
        const markerFileName = '.fruitygit-extracted.marker';
        const markerPath = window.electronAPI.pathJoin(extractTo, markerFileName);

        // Replace existing extracted project contents (if any), but only if the folder
        // is one we previously created. This prevents accidental deletion of
        // user folders if paths are misconfigured.
        const markerExists = await window.electronAPI.fileExists(markerPath);
        if (markerExists) {
          const delResult = await window.electronAPI.rmrfUnder(uploadsRoot, extractTo);
          if (!delResult?.success) {
            throw new Error(delResult?.error || 'Не удалось удалить старые распакованные файлы');
          }
        }

        await window.electronAPI.mkdir(extractTo, { recursive: true });
        await window.electronAPI.extractZip(zipPath, extractTo);
        // Write marker after successful extraction.
        await window.electronAPI.writeFile(markerPath, `${new Date().toISOString()}\n`);

        const addResult = await window.electronAPI.git.add(localPath, extractTo);
        if (!addResult.success) {
          throw new Error(addResult.error || 'Не удалось добавить распакованные файлы в индекс');
        }

        setAttachedFile(extractTo);
        alert('Архив распакован и добавлен в локальный репозиторий. Нажмите «Коммит», чтобы создать коммит.');
        return extractTo;
      } else {
        setFlpProcessingMessage('Подготовка локальной копии репозитория…');
        const localPath = await ensureLocalRepoFor(selectedRepo, user.name);
        if (!localPath) {
          alert('Выберите папку для клонирования репозитория');
          return;
        }
        const stagedPath = await stageFileInLocalRepo(filePath, localPath);
        setAttachedFile(stagedPath);
        alert('Файл добавлен в локальный репозиторий. Нажмите «Коммит», чтобы создать коммит.');
        return stagedPath;
      }
    } catch (error) {
      console.error('Error processing FLP file:', error);
      alert(`Ошибка: ${error.message}`);
    } finally {
      setIsFlpProcessing(false);
      setFlpProcessingMessage('');
    }
  };

  const handleCreateRepo = (repoData) => {
    setShowCreateRepo(false);
    handleRefreshRepo();
  };

  const refreshLocalAheadCount = useCallback(async (repoPath) => {
    const target = repoPath || localRepoPath;
    if (!target) {
      setLocalAheadCount(0);
      return;
    }
    try {
      const statusResult = await window.electronAPI.git.status(target);
      if (statusResult?.success) {
        const ahead = Number(statusResult.status?.ahead || 0);
        setLocalAheadCount(Number.isFinite(ahead) ? ahead : 0);
      }
    } catch {
      // best-effort
    }
  }, [localRepoPath]);

  const clearAppState = () => {
    setRepoName('');
    setSummary('');
    setDescription('');
    setRepos([]);
    setCommits([]);
    setSelectedCommit(null);
    setAttachedFile(null);
    setSelectedRepo(null);
    setLocalRepoPath(null);
    setRepoPathMap({});
  };


  const handleShowRepo = async (repo) => {
    if (!repo || !user) return;
    try {
      const localPath = await ensureLocalRepoFor(repo, user.name);
      if (!localPath) {
        alert('Выберите папку для клонирования репозитория');
        return;
      }

      const localCommits = await GitService.getLocalHistory(localPath);
      setCommits(localCommits);
    } catch (error) {
      console.error('Show repo error:', error);
      alert(error.message);
    }
  };


  const handleChooseLocalFolder = async () => {
    if (!selectedRepo) {
      alert('Сначала выберите удалённый репозиторий');
      return;
    }

    try {
      const folderPath = await window.electronAPI.openFolderDialog();
      if (!folderPath) return;
      if (!user) {
        throw new Error('Сначала выполните вход');
      }

      const { owner, name, fullName } = parseRepoRef(selectedRepo, user?.name);
      if (!name || !owner) {
        throw new Error('Некорректный выбор репозитория');
      }

      const candidateSelfRepoPath = folderPath;
      const candidateSubRepoPath = window.electronAPI.pathJoin(folderPath, name);

      if (await isGitRepositoryPath(candidateSelfRepoPath)) {
        await ensureLocalRepoMatchesSelected(candidateSelfRepoPath, owner, name);
        await GitService.pullFromServer(candidateSelfRepoPath, 'main');
        setRepoPathMap(prev => ({ ...prev, [name]: candidateSelfRepoPath, [fullName]: candidateSelfRepoPath }));
        setLocalRepoPath(candidateSelfRepoPath);
        return;
      }

      if (await isGitRepositoryPath(candidateSubRepoPath)) {
        await ensureLocalRepoMatchesSelected(candidateSubRepoPath, owner, name);
        await GitService.pullFromServer(candidateSubRepoPath, 'main');
        setRepoPathMap(prev => ({ ...prev, [name]: candidateSubRepoPath, [fullName]: candidateSubRepoPath }));
        setLocalRepoPath(candidateSubRepoPath);
        return;
      }

      // If folder is empty for <folder>/<repo>, clone; otherwise error
      const isEmpty = await window.electronAPI.dirIsEmpty(candidateSubRepoPath);
      if (!isEmpty) {
        throw new Error('Выбранная папка не пустая и не содержит git-репозиторий этого проекта.');
      }

      const repoInfo = await getRepoInfo(owner, name);
      const giteaRepoUrl = normalizeCloneUrl(repoInfo.clone_url);
      await GitService.cloneRepo(giteaRepoUrl, candidateSubRepoPath, user);

      setRepoPathMap(prev => ({ ...prev, [name]: candidateSubRepoPath, [fullName]: candidateSubRepoPath }));
      setLocalRepoPath(candidateSubRepoPath);
    } catch (error) {
      console.error('Error choosing folder:', error);
      alert(`Ошибка: ${error.message}`);
    }
  };

  const handleRefreshRepo = useCallback(async () => {
    if (!user) return;

    setIsLoadingRepos(true);
    try {
      const [ownResponse, publicResponse] = await Promise.all([
        fetchWithGitea(`${serverPath}/gitea/api/v1/user/repos`, { method: 'GET' }),
        fetchWithGitea(`${serverPath}/gitea/api/v1/repos/search?limit=100&page=1`, { method: 'GET' })
      ]);

      const ownRepos = await ownResponse.json();
      const publicPayload = await publicResponse.json();
      const publicRepos = Array.isArray(publicPayload) ? publicPayload : (publicPayload.data || []);

      const toRepoItem = (r) => {
        const fullName = r?.full_name || (r?.owner?.login && r?.name ? `${r.owner.login}/${r.name}` : null);
        const parsed = parseRepoRef(fullName || r?.name, user?.name);
        return {
          fullName: parsed.fullName || fullName || r?.name || '',
          name: r?.name || parsed.name || '',
          owner: r?.owner?.login || parsed.owner || '',
          description: r?.description || ''
        };
      };

      const merged = [...(Array.isArray(ownRepos) ? ownRepos : []), ...(Array.isArray(publicRepos) ? publicRepos : [])]
        .map(toRepoItem)
        .filter(r => r.fullName);

      const uniqMap = new Map();
      for (const r of merged) {
        const key = String(r.fullName).toLowerCase();
        if (!uniqMap.has(key)) uniqMap.set(key, r);
      }

      const uniq = Array.from(uniqMap.values())
        .sort((a, b) => String(a.fullName).localeCompare(String(b.fullName), 'ru'));

      setRepos(uniq);
    } catch (error) {
      console.error('Refresh repo error:', error);
      alert(error.message);
    } finally {
      setIsLoadingRepos(false);
    }
  }, [user, serverPath]);

  const handleSelectRepo = async (repoFullName) => {
    if (!repoFullName) return;
    setShowRepoPicker(false);
    setSelectedRepo(repoFullName);
    if (user) {
      const { name, fullName } = parseRepoRef(repoFullName, user?.name);
      setLocalRepoPath(repoPathMap[fullName] || repoPathMap[name] || null);
    }
    await handleShowRepo(repoFullName);
  };

  const runFullDiagnostics = async () => {
    if (isRunningDiagnostics) return 'Диагностика уже запущена.';
    if (!user) throw new Error('Сначала выполните вход.');
    if (!window.electronAPI) throw new Error('Electron API недоступен.');

    setIsRunningDiagnostics(true);

    const lines = [];
    const addLine = (label, ok, details = '') => {
      const status = ok ? 'ОК' : 'ОШИБКА';
      lines.push(`${status} | ${label}${details ? ` | ${details}` : ''}`);
    };

    const ownerName = user?.name || '';
    const accessToken = getAccessToken();
    const currentGiteaToken = getGiteaToken();

    const fetchWithToken = async (url, token, options = {}) => {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `token ${token}`,
        'X-Gitea-Token': token,
        ...(options.headers || {})
      };
      return fetch(url, { ...options, headers });
    };

    const cleanupTemp = async (diagRoot) => {
      try {
        if (diagRoot) {
          await window.electronAPI.rmrf(diagRoot);
        }
      } catch (e) {
        // ignore cleanup errors
      }
    };

    let diagRoot = null;
    let publicRepoName = null;
    let privateRepoName = null;

    try {
      addLine('Проверка health endpoint backend', true);
      try {
        const response = await fetchWithTimeout(`${serverPath}/health`);
        addLine('Проверка health endpoint backend', response.ok, `HTTP ${response.status}`);
      } catch (error) {
        addLine('Проверка health endpoint backend', false, error.message);
      }

      try {
        const response = await fetchWithTimeout(`${serverPath}/gitea/api/v1/version`);
        addLine('Проверка proxy endpoint Gitea', response.ok, `HTTP ${response.status}`);
      } catch (error) {
        addLine('Проверка proxy endpoint Gitea', false, error.message);
      }

      addLine('Токен Gitea в localStorage', !!currentGiteaToken, currentGiteaToken ? 'есть' : 'отсутствует');
      if (!currentGiteaToken) throw new Error('Токен Gitea не найден в localStorage (требуется вход).');

      try {
        await GitService.checkGitInstalled();
        addLine('Git установлен', true);
      } catch (error) {
        addLine('Git установлен', false, error.message);
      }

      // Create local temp directory for git clones and test files.
      const appPath = await window.electronAPI.getAppPath();
      const runId = `diag-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      const tempBase = window.electronAPI.pathJoin(appPath, 'temp', runId);
      diagRoot = tempBase;
      await window.electronAPI.mkdir(tempBase, { recursive: true });

      // Generate unique repo names.
      publicRepoName = `diag-public-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`.replace(/[^a-zA-Z0-9_-]/g, '');
      privateRepoName = `diag-private-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`.replace(/[^a-zA-Z0-9_-]/g, '');

      const createRepo = async (name, isPrivate) => {
        const response = await fetchWithGitea(`${serverPath}/gitea/api/v1/user/repos`, {
          method: 'POST',
          body: JSON.stringify({
            name,
            private: isPrivate,
            auto_init: true,
            default_branch: 'main'
          })
        });
        return response.json();
      };

      addLine('Создание публичного тестового репозитория', true);
      const publicRepo = await createRepo(publicRepoName, false);
      addLine('Создание публичного тестового репозитория', !!publicRepo?.name, publicRepo?.name || 'имя отсутствует');

      addLine('Создание приватного тестового репозитория', true);
      const privateRepo = await createRepo(privateRepoName, true);
      addLine('Создание приватного тестового репозитория', !!privateRepo?.name, privateRepo?.name || 'имя отсутствует');

      // OWNER: clone before push to test pull
      const publicCloneBefore = window.electronAPI.pathJoin(tempBase, 'publicBefore');
      const publicCloneAfter = window.electronAPI.pathJoin(tempBase, 'publicAfter');
      const privateCloneOwner = window.electronAPI.pathJoin(tempBase, 'privateOwner');

      const remotePublicUrl = `${serverPath}/gitea/${ownerName}/${publicRepoName}.git`;
      const remotePrivateUrl = `${serverPath}/gitea/${ownerName}/${privateRepoName}.git`;

      await GitService.cloneRepo(remotePublicUrl, publicCloneBefore, user);
      addLine('Клонирование публичного репозитория (до push)', true, publicCloneBefore);

      await GitService.cloneRepo(remotePublicUrl, publicCloneAfter, user);
      addLine('Клонирование публичного репозитория (после push)', true, publicCloneAfter);

      // Commit #1: add file
      const uploadsDirA = window.electronAPI.pathJoin(publicCloneAfter, 'uploads');
      const diagFile1 = window.electronAPI.pathJoin(uploadsDirA, 'diag1.txt');
      await window.electronAPI.mkdir(uploadsDirA, { recursive: true });
      await window.electronAPI.writeFile(diagFile1, 'v1');

      await GitService.commitFile(publicCloneAfter, diagFile1, 'Diag v1', 'add', user);
      await GitService.pushToServer(publicCloneAfter, 'main');
      addLine('Коммит v1 + push (публичный)', true);

      // Pull into cloneBefore
      await GitService.pullFromServer(publicCloneBefore, 'main');
      const diagFile1InBefore = window.electronAPI.pathJoin(publicCloneBefore, 'uploads', 'diag1.txt');
      const existsAfterV1 = await window.electronAPI.fileExists(diagFile1InBefore);
      addLine('Pull публичного репозитория после push (файл существует)', existsAfterV1, existsAfterV1 ? 'diag1.txt присутствует' : 'diag1.txt отсутствует');

      // Commit #2: modify file
      await window.electronAPI.writeFile(diagFile1, 'v2');
      await GitService.commitFile(publicCloneAfter, diagFile1, 'Diag v2', 'modify', user);
      await GitService.pushToServer(publicCloneAfter, 'main');
      addLine('Коммит v2 + push (публичный)', true);

      await GitService.pullFromServer(publicCloneBefore, 'main');

      const publicHistory = await GitService.getLocalHistory(publicCloneBefore, 10);
      const commitV2 = publicHistory.find(c => c.summary === 'Diag v2');
      const diagInHistoryV2Modified = (commitV2?.modifiedFiles || []).includes('uploads/diag1.txt');
      addLine('Детали коммита: diag1 отмечен как изменённый', diagInHistoryV2Modified, diagInHistoryV2Modified ? 'modifiedFiles содержит uploads/diag1.txt' : 'modifiedFiles пуст/отсутствует');

      // Commit #3: delete file
      await window.electronAPI.rmrf(diagFile1);
      await window.electronAPI.git.add(publicCloneAfter, '.');
      await window.electronAPI.git.commit(publicCloneAfter, 'Diag delete_summEnd_delete', { name: user.name, email: user.email });
      await GitService.pushToServer(publicCloneAfter, 'main');
      addLine('Коммит удаления + push (публичный)', true);

      await GitService.pullFromServer(publicCloneBefore, 'main');
      const existsAfterDelete = await window.electronAPI.fileExists(diagFile1InBefore);
      addLine('Pull публичного репозитория после удаления (файл отсутствует)', !existsAfterDelete, existsAfterDelete ? 'diag1.txt всё ещё существует' : 'diag1.txt удалён');

      const publicHistory2 = await GitService.getLocalHistory(publicCloneBefore, 10);
      const commitDelete = publicHistory2.find(c => c.summary === 'Diag delete');
      const diagInHistoryDeleted = (commitDelete?.deletedFiles || []).includes('uploads/diag1.txt');
      addLine('Детали коммита: diag1 отмечен как удалённый', diagInHistoryDeleted, diagInHistoryDeleted ? 'deletedFiles содержит uploads/diag1.txt' : 'deletedFiles пуст/отсутствует');

      // OWNER: private repo commit
      await GitService.cloneRepo(remotePrivateUrl, privateCloneOwner, user);
      addLine('Клонирование приватного репозитория (владелец)', true, privateCloneOwner);

      const privateUploadsDir = window.electronAPI.pathJoin(privateCloneOwner, 'uploads');
      const privateFile = window.electronAPI.pathJoin(privateUploadsDir, 'secret.txt');
      await window.electronAPI.mkdir(privateUploadsDir, { recursive: true });
      await window.electronAPI.writeFile(privateFile, 'secret');
      await GitService.commitFile(privateCloneOwner, privateFile, 'Private diag', 'add', user);
      await GitService.pushToServer(privateCloneOwner, 'main');
      addLine('Приватный коммит + push (владелец)', true);

      // Contributor: register + login (get their gitea token)
      const randomSuffix = Math.random().toString(36).slice(2, 8);
      const contributorUserName = `diaguser_${randomSuffix}`;
      const contributorEmail = `diaguser_${randomSuffix}@tmp.local`;
      const contributorPassword = `P@${randomSuffix}!aA1`;

      const registerRes = await fetch(`${serverPath}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          UserName: contributorUserName,
          Email: contributorEmail,
          Password: contributorPassword,
          RoleName: 'User'
        })
      });

      if (!registerRes.ok) {
        throw new Error(`Не удалось зарегистрировать участника: ${await registerRes.text()}`);
      }

      const loginRes = await fetch(`${serverPath}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Email: contributorEmail, Password: contributorPassword })
      });

      if (!loginRes.ok) {
        throw new Error(`Не удалось выполнить вход участника: ${await loginRes.text()}`);
      }

      const loginPayload = await loginRes.json();
      const contributorGiteaToken = loginPayload?.giteaToken;
      if (!contributorGiteaToken) {
        throw new Error('В ответе входа отсутствует токен Gitea для участника.');
      }

      // Contributor: view public repo should be allowed
      const publicInfoRes = await fetchWithToken(
        `${serverPath}/gitea/api/v1/repos/${ownerName}/${publicRepoName}`,
        contributorGiteaToken
      );
      addLine('Участник может просматривать публичный репозиторий', publicInfoRes.ok, `HTTP ${publicInfoRes.status}`);

      // Contributor: view private repo should fail before allow-user
      const privateInfoBefore = await fetchWithToken(
        `${serverPath}/gitea/api/v1/repos/${ownerName}/${privateRepoName}`,
        contributorGiteaToken
      );
      addLine('Участник не может просматривать приватный репозиторий (до выдачи доступа)', !privateInfoBefore.ok, `HTTP ${privateInfoBefore.status}`);

      // Contributor: clone private repo should fail before allow
      const contributorCloneBefore = window.electronAPI.pathJoin(tempBase, 'contribPrivateBefore');
      let contributorCloneBeforeOk = false;
      let contributorCloneBeforeErr = '';
      try {
        const res = await window.electronAPI.git.clone(remotePrivateUrl, contributorCloneBefore, {
          username: contributorUserName,
          password: contributorGiteaToken,
          token: contributorGiteaToken
        });
        contributorCloneBeforeOk = !!res?.success;
        contributorCloneBeforeErr = res?.error || '';
      } catch (e) {
        contributorCloneBeforeOk = false;
        contributorCloneBeforeErr = e?.message || String(e);
      }
      addLine(
        'Клонирование приватного репозитория участником не проходит (до выдачи доступа)',
        !contributorCloneBeforeOk,
        contributorCloneBeforeOk ? `неожиданный успех${contributorCloneBeforeErr ? `: ${contributorCloneBeforeErr}` : ''}` : `клонирование отклонено${contributorCloneBeforeErr ? `: ${contributorCloneBeforeErr}` : ''}`
      );

      // Allow contributor to private repo using backend endpoint
      if (!accessToken) throw new Error('Отсутствует токен доступа владельца.');
      const allowRes = await fetch(`${serverPath}/api/git/${encodeURIComponent(ownerName)}/${encodeURIComponent(privateRepoName)}/allow-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ email: contributorEmail })
      });

      const allowPayload = await allowRes.json().catch(() => ({}));
      addLine('Владелец выдаёт участнику право записи через allow-user', allowRes.ok, allowPayload?.message || `HTTP ${allowRes.status}`);

      // Contributor: view private repo should work now
      const privateInfoAfter = await fetchWithToken(
        `${serverPath}/gitea/api/v1/repos/${ownerName}/${privateRepoName}`,
        contributorGiteaToken
      );
      addLine('Участник может просматривать приватный репозиторий (после выдачи доступа)', privateInfoAfter.ok, `HTTP ${privateInfoAfter.status}`);

      // Contributor: clone private repo and push a commit
      const contributorCloneAfter = window.electronAPI.pathJoin(tempBase, 'contribPrivateAfter');
      const contributorCloneAfterRes = await window.electronAPI.git.clone(remotePrivateUrl, contributorCloneAfter, {
        username: contributorUserName,
        password: contributorGiteaToken,
        token: contributorGiteaToken
      });
      if (!contributorCloneAfterRes?.success) {
        throw new Error(contributorCloneAfterRes?.error || 'Клонирование участником после выдачи доступа не удалось.');
      }

      const contributorUploadsDir = window.electronAPI.pathJoin(contributorCloneAfter, 'uploads');
      const contributorFile = window.electronAPI.pathJoin(contributorUploadsDir, 'contrib.txt');
      await window.electronAPI.mkdir(contributorUploadsDir, { recursive: true });
      await window.electronAPI.writeFile(contributorFile, 'contrib');
      await window.electronAPI.git.add(contributorCloneAfter, contributorFile);
      await window.electronAPI.git.commit(contributorCloneAfter, 'Contrib push_summEnd_contrib', { name: contributorUserName, email: contributorEmail });
      await window.electronAPI.git.push(contributorCloneAfter, 'origin', 'main', {
        username: contributorUserName,
        password: contributorGiteaToken,
        token: contributorGiteaToken
      });
      addLine('Коммит и push участника в приватный репозиторий', true);

      // Verify owner clone can pull new file
      await GitService.pullFromServer(privateCloneOwner, 'main');
      const contributorFileInOwner = window.electronAPI.pathJoin(privateCloneOwner, 'uploads', 'contrib.txt');
      const contributorFileExists = await window.electronAPI.fileExists(contributorFileInOwner);
      addLine('Владелец получает файл участника', contributorFileExists, contributorFileExists ? 'contrib.txt присутствует' : 'contrib.txt отсутствует');

      return lines.join('\n');
    } catch (error) {
      lines.push(`ОШИБКА | Ошибка диагностики | ${error?.message || error}`);
      return lines.join('\n');
    } finally {
      setIsRunningDiagnostics(false);
      // Best-effort cleanup: local clones only; git repos/user cleanup is optional.
      try {
        if (diagRoot) {
          await cleanupTemp(diagRoot);
        }
      } catch (e) {
        // ignore
      }

      // Best-effort cleanup: delete temp repos in Gitea.
      try {
        if (currentGiteaToken && ownerName && publicRepoName) {
          await fetchWithGitea(`${serverPath}/gitea/api/v1/repos/${ownerName}/${publicRepoName}`, { method: 'DELETE' });
        }
      } catch (e) {
        // ignore
      }

      try {
        if (currentGiteaToken && ownerName && privateRepoName) {
          await fetchWithGitea(`${serverPath}/gitea/api/v1/repos/${ownerName}/${privateRepoName}`, { method: 'DELETE' });
        }
      } catch (e) {
        // ignore
      }
    }
  };

  const handleAllowUser = async () => {
    if (!user) {
      alert('Сначала выполните вход');
      return;
    }

    if (!selectedRepo) {
      alert('Сначала выберите репозиторий');
      return;
    }

    const email = allowUserEmail.trim();
    if (!email) {
      alert('Введите email');
      return;
    }

    const { owner, name } = parseRepoRef(selectedRepo, user.name);
    if (!owner || !name) {
      alert('Некорректный выбор репозитория');
      return;
    }

    if (owner.toLowerCase() !== (user.name || '').toLowerCase()) {
      alert('Добавлять участников может только владелец репозитория.');
      return;
    }

    try {
      setIsAllowingUser(true);
      const response = await fetch(`${serverPath}/api/git/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/allow-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAccessToken()}`
        },
        body: JSON.stringify({ email })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || payload?.Message || 'Не удалось добавить пользователя');
      }

      setAllowUserEmail('');
      alert(payload?.message || payload?.Message || 'Пользователь теперь имеет доступ на отправку изменений');
    } catch (error) {
      console.error('Allow user error:', error);
      alert(`Не удалось добавить пользователя: ${error.message}`);
    } finally {
      setIsAllowingUser(false);
    }
  };

  const handleCommitSelect = (commit) => {
    if (!commit) return;
    setShowPluginsInDetails(false);

    const formatCommitMessage = (message) => {
      if (message.includes('_summEnd_')) {
        const [summary, description] = message.split('_summEnd_');
        return `Кратко: ${summary.trim()}\n\nОписание: ${description.trim()}`;
      }
      return `Кратко: ${message.trim()}`;
    };

    const formatFileList = (label, files) => {
      const list = (files || []).filter(Boolean);
      if (list.length === 0) return `${label}: (нет)`;
      return `${label}:\n${list.map(f => `- ${f}`).join('\n')}`;
    };

    const formatBpmChanges = (changes) => {
      const list = (changes || []).filter(Boolean);
      if (list.length === 0) return 'Изменения базового BPM: (нет)';
      return `Изменения базового BPM:\n${list.map(item => `- ${item}`).join('\n')}`;
    };

    setSelectedCommit({
      ...commit,
      formattedDetails: `Коммит: ${commit.id}
Автор: ${commit.author} <${commit.email}>
Дата: ${new Date(commit.date).toLocaleString()}

${formatCommitMessage(commit.message)}

${formatFileList('Добавлено', commit.addedFiles)}
${formatFileList('Удалено', commit.deletedFiles)}
${formatFileList('Изменено', commit.modifiedFiles)}
${formatBpmChanges(commit.baseBpmChanges)}`
    });
  };

  const formatPluginList = (title, list) => {
    const safeList = (list || []).filter(Boolean);
    if (safeList.length === 0) return `${title}: (нет)`;
    return `${title}:\n${safeList.map(item => `- ${item}`).join('\n')}`;
  };

  const getSelectedCommitPluginsText = () => {
    if (!selectedCommit?.pluginSnapshot) {
      return 'Для этого коммита данные о плагинах не найдены.';
    }

    const generators = selectedCommit.pluginSnapshot.generators || [];
    const effects = selectedCommit.pluginSnapshot.effects || [];

    return [
      formatPluginList('Генераторы', generators),
      '',
      formatPluginList('Эффекты', effects)
    ].join('\n');
  };


  const handleDownloadRepo = async () => {
    if (!selectedRepo || !user) {
      alert('Выберите репозиторий и убедитесь, что вы вошли в систему');
      return;
    }

    try {
      const clonePath = await ensureLocalRepoFor(selectedRepo, user.name);
      if (!clonePath) return;

      // Уведомляем пользователя об успешном клонировании
      alert(`Репозиторий клонирован в: ${clonePath}\nПри необходимости архив можно создать вручную.`);
    } catch (error) {
      console.error('Download error:', error);
      alert(`Ошибка скачивания: ${error.message}`);
    }
  };

  // Handle "Clone to Local" button
  const handleCloneToLocal = async () => {
    if (!selectedRepo || !user) {
      alert('Выберите репозиторий и сначала выполните вход');
      return;
    }
    try {
      const localPath = await ensureLocalRepoFor(selectedRepo, user.name);
      if (!localPath) return;

      setIsLoadingRepos(true);
      const { name, fullName } = parseRepoRef(selectedRepo, user?.name);
      setRepoPathMap(prev => ({ ...prev, [name || selectedRepo]: localPath, [fullName || selectedRepo]: localPath }));
      setLocalRepoPath(localPath);
      alert(`Репозиторий клонирован в: ${localPath}`);
      const localCommits = await GitService.getLocalHistory(localPath);
      setCommits(localCommits);
      await refreshLocalAheadCount(localPath);
    } catch (error) {
      console.error('Clone error:', error);
      alert(`Не удалось клонировать: ${error.message}`);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  // Handle "Commit to Local" (instead of sending to server directly)
  const handleCommitToLocal = async () => {
    if (!localRepoPath || !summary) {
      alert('Выберите локальный репозиторий и добавьте краткое описание');
      return;
    }

    try {
      const statusResult = await window.electronAPI.git.status(localRepoPath);
      if (!statusResult.success) {
        throw new Error(statusResult.error || 'Не удалось получить статус репозитория');
      }

      if (statusResult.status.isClean) {
        alert('Нет подготовленных изменений. Сначала используйте «Прикрепить файл».');
        return;
      }

      await GitService.commitStagedChanges(localRepoPath, summary, description, user);

      alert('Файл закоммичен в локальный репозиторий!');

      // Refresh local history view
      const localCommits = await GitService.getLocalHistory(localRepoPath);
      setCommits(localCommits);
      await refreshLocalAheadCount(localRepoPath);

      // Clear form
      setSummary('');
      setDescription('');
      setAttachedFile(null);

    } catch (error) {
      console.error('Local commit error:', error);
      alert(`Ошибка коммита: ${error.message}`);
    }
  };

  // Handle "Push to Server" (sync local -> remote)
  const handlePushToServer = async () => {
    if (!localRepoPath) {
      alert('Выберите локальный репозиторий');
      return;
    }
    try {
      setIsLoadingRepos(true);
      if (selectedRepo && user) {
        const { owner, name } = parseRepoRef(selectedRepo, user.name);
        if (owner && name) {
          const repoInfo = await getRepoInfo(owner, name);
          const canPush = repoInfo?.permissions?.push === true;
          if (!canPush) {
            throw new Error(`Нет права записи для ${owner}/${name}. Текущий пользователь может читать, но не может отправлять изменения.`);
          }
        }
      }

      await GitService.pushToServer(localRepoPath, 'main');
      alert('Изменения успешно отправлены на сервер!');
      await handleRefreshRepo();
      if (selectedRepo) {
        await handleShowRepo(selectedRepo);
      }
      await refreshLocalAheadCount(localRepoPath);
    } catch (error) {
      console.error('Push error:', error);
      if (error?.message?.includes('User permission denied for writing')) {
        alert('Отправка не удалась: у текущей учётной записи только доступ на чтение. Попросите владельца выдать право записи или используйте токен пользователя с доступом на отправку.');
      } else {
        alert(`Ошибка отправки: ${error.message}`);
      }
    } finally {
      setIsLoadingRepos(false);
    }
  };


  // Handle "Pull from Server" (sync remote -> local)
  const handlePullFromServer = async () => {
    if (!localRepoPath) {
      alert('Сначала выберите локальный репозиторий');
      return;
    }

    try {
      setIsLoadingRepos(true);
      await GitService.pullFromServer(localRepoPath, 'main');
      alert('Последние изменения с сервера успешно получены');

      // Refresh local history
      const localCommits = await GitService.getLocalHistory(localRepoPath);
      setCommits(localCommits);
      await refreshLocalAheadCount(localRepoPath);
    } catch (error) {
      console.error('Pull error:', error);
      alert(`Ошибка получения: ${error.message}`);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  useEffect(() => {
    if (user) return;

    const verifyToken = async () => {
      const storedUser = localStorage.getItem('user');
      const accessToken = getAccessToken();

      if (storedUser && accessToken) {
        try {
          // Validate token with server
          const response = await fetch(`${serverPath}/api/auth/validate?email=${encodeURIComponent(JSON.parse(storedUser).email)}&token=${accessToken}`);

          if (response.ok) {
            setUser(JSON.parse(storedUser));
            handleRefreshRepo();
          } else {
            // Token is invalid, try to refresh
            const newToken = await refreshAuthToken(serverPath);
            if (newToken) {
              setUser(JSON.parse(storedUser));
              handleRefreshRepo();
            } else {
              clearAppState();
            }
          }
        } catch (error) {
          console.error('Token validation error:', error);
          clearAppState();
        }
      } else {
        clearAppState();
      }
    };

    verifyToken();
  }, [user, handleRefreshRepo, serverPath]);
  useEffect(() => {
    const checkGit = async () => {
      try {
        await GitService.checkGitInstalled();
        setGitError(null);
      } catch (err) {
        setGitError(err.message);
        // Optionally show a helpful UI message
      }
    };
    checkGit();
  }, []);
  // Load saved repo-path associations from localStorage
  useEffect(() => {
    const savedMap = localStorage.getItem('repoPathMap');
    if (savedMap) {
      try {
        setRepoPathMap(JSON.parse(savedMap));
      } catch (e) {
        console.error('Failed to parse repoPathMap', e);
      }
    }
  }, []);

  // Save mapping whenever it changes
  useEffect(() => {
    localStorage.setItem('repoPathMap', JSON.stringify(repoPathMap));
  }, [repoPathMap]);

  useEffect(() => {
    if (!localRepoPath) {
      setLocalAheadCount(0);
      return;
    }
    refreshLocalAheadCount(localRepoPath);
  }, [localRepoPath, refreshLocalAheadCount]);

  return (
    <div className="app-container">
      {/* Top Bar */}
      <div className="top-bar">
        <div className="app-brand">
          <span className="app-brand-title">FruityGit Desktop</span>
          <span className="app-brand-subtitle">Совместная работа над проектами FL Studio</span>
        </div>
        {user ? (
          <div className="user-info">
            <span className="user-label">Выполнен вход: {user.name || user.email}</span>
            <button className="logout-button" onClick={() => {
              setUser(null);
              localStorage.removeItem('user');
              clearAppState();  // Add this line
            }}>
              Выйти
            </button>
          </div>
        ) : (
          <button className="login-button" onClick={handleLogin}>
            Вход
          </button>
        )}
        <button
          className="settings-button"
          onClick={() => setShowSettings(true)}
          disabled={isRunningDiagnostics}
          title="Настроить адрес сервера"
          type="button"
        >
          Настройки
        </button>
      </div>

      <div className="main-grid">
        {/* Left Side - Column 0 */}
        <div className="left-column">
          {/* Attach File Section */}

          <div className="section">
            <div className="toggle-container">
              <label className="toggle-label">
                Обрабатывать через Python:
                <input
                  type="checkbox"
                  checked={processWithPython}
                  onChange={() => setProcessWithPython(!processWithPython)}
                  className="toggle-switch"
                />
              </label>
            </div>

            <button className="action-button" onClick={handleAttachFile}>
              Прикрепить файл
            </button>

            {attachedFile && (
              <div className="attached-file-info">
                Прикреплён: {attachedFile}
                <br />
                Режим: {processWithPython ? "Обработка Python" : "Прямая загрузка"}
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Кратко:</label>
              <input
                type="text"
                className="text-input"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Краткое описание"
              />
            </div>

            <textarea
              className="description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Полное описание"
            />
          </div>

          {/* Repository Section */}
          <div className="section repo-section">
            <h2 className="section-title">Репозитории</h2>
            <div className="repo-picker-row-inline">
              <div className="repo-picked">
                <div className="repo-picked-label">Выбранный репозиторий</div>
                <div className="repo-picked-value">{selectedRepo || 'не выбран'}</div>
              </div>
              <div className="repo-picked-actions">
                <button
                  className="repo-action-button"
                  type="button"
                  onClick={() => setShowRepoPicker(true)}
                  disabled={!user || isLoadingRepos}
                  title={!user ? 'Сначала выполните вход' : 'Открыть список репозиториев'}
                >
                  Выбрать репозиторий
                </button>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Новое:</label>
              <input
                type="text"
                className="repo-input"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="Имя для нового репозитория"
              />
            </div>

            <button
              className="repo-action-button"
              onClick={() => setShowCreateRepo(true)}
              disabled={!user}
              title={!user ? 'Сначала выполните вход' : 'Создать новый репозиторий'}
            >
              Создать репозиторий
            </button>

            <div className="repo-buttons">
              {selectedRepo && user && (() => {
                const { owner } = parseRepoRef(selectedRepo, user?.name);
                return owner && owner.toLowerCase() === (user?.name || '').toLowerCase();
              })() && (
                <div className="allow-user-row">
                  <input
                    type="email"
                    className="repo-input"
                    placeholder="Email участника"
                    value={allowUserEmail}
                    onChange={(e) => setAllowUserEmail(e.target.value)}
                    disabled={isAllowingUser}
                    maxLength={254}
                  />
                  <button
                    className="repo-action-button"
                    onClick={handleAllowUser}
                    disabled={isAllowingUser || !allowUserEmail.trim()}
                    title="Выдать этому пользователю право отправки"
                  >
                    {isAllowingUser ? 'Выдача доступа...' : 'Добавить участника'}
                  </button>
                </div>
              )}
              <div className="local-repo-selector">
                <span className="local-repo-label">
                  Локальный репозиторий: {localRepoPath || 'не выбран'}
                </span>
                {selectedRepo && !localRepoPath && (
                  <div className="suggestion-message">
                    Для этого репозитория не указана локальная папка.
                    <button
                      className="repo-action-button small"
                      onClick={handleChooseLocalFolder}
                    >
                      Создать локальную папку
                    </button>
                  </div>
                )}
                {selectedRepo && localRepoPath && (
                  <div className="local-repo-actions">
                    <button
                      className="repo-action-button small"
                      onClick={handleChooseLocalFolder}
                    >
                      Изменить локальную папку
                    </button>
                  </div>
                )}
                <div className="git-sync-buttons">
                  <button
                    className="repo-action-button"
                    onClick={handleCloneToLocal}
                    disabled={!selectedRepo || isLoadingRepos}
                    title="Клонировать удалённый репозиторий в локальную папку"
                  >
                    📥 Клонировать локально
                  </button>

                  {localRepoPath && (
                    <>
                      <button
                        className="repo-action-button"
                        onClick={handleCommitToLocal}
                        disabled={!summary}
                        title="Закоммитить подготовленные изменения в локальный репозиторий"
                      >
                        💾 Коммит
                      </button>

                      <button
                        className="repo-action-button"
                        onClick={handlePullFromServer}
                        disabled={isLoadingRepos}
                        title="Получить последние изменения с сервера"
                      >
                        ⬇️ Получить
                      </button>

                      <button
                        className="repo-action-button"
                        onClick={handlePushToServer}
                        disabled={isLoadingRepos}
                        title="Отправить локальные изменения на сервер"
                      >
                        ⬆️ Отправить{localAheadCount > 0 ? ` (${localAheadCount})` : ''}
                      </button>
                    </>
                  )}
                </div>

                {gitError && (
                  <div className="git-error-banner">
                    ⚠️ {gitError}
                    <a href="https://git-scm.com/downloads" target="_blank" rel="noopener noreferrer">
                      Установить Git
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Column 1 */}
        <div className="right-column">
          {/* History Section */}
          <div className="section history-section">
            <h2 className="section-title">История</h2>
            <ul className="commit-list">
              {commits && commits.length > 0 ? (
                commits.map(commit => (
                  <li
                    key={commit.id}
                    className="commit-item"
                    onClick={() => handleCommitSelect(commit)}
                  >
                    <div className="commit-message">{commit.summary}</div>
                    <div className="commit-date">
                      {new Date(commit.date).toLocaleString()}
                    </div>
                  </li>
                ))
              ) : (
                <li>Коммиты не найдены</li>
              )}
            </ul>
          </div>

          {/* Details Section */}
          <div className="section details-section">
            <h2 className="section-title">Детали</h2>
            <div className="commit-details">
              {selectedCommit && (
                <button
                  className="repo-action-button small"
                  type="button"
                  onClick={() => setShowPluginsInDetails(prev => !prev)}
                >
                  {showPluginsInDetails ? 'Скрыть плагины' : 'Показать плагины'}
                </button>
              )}
              {selectedCommit?.formattedDetails ? (
                <>
                  <pre>{selectedCommit.formattedDetails}</pre>
                  {showPluginsInDetails && <pre>{getSelectedCommitPluginsText()}</pre>}
                </>
              ) : selectedCommit ? (
                <>
                  <div className="commit-header">
                    <p>Коммит: {selectedCommit.id}</p>
                    <p>Автор: {selectedCommit.author} &lt;{selectedCommit.email}&gt;</p>
                    <p>Дата: {new Date(selectedCommit.date).toLocaleString()}</p>
                  </div>

                  {selectedCommit.message.includes('_summEnd_') ? (
                    <>
                      <h3>Кратко:</h3>
                      <p>{selectedCommit.message.split('_summEnd_')[0].trim()}</p>
                      <h3>Описание:</h3>
                      <p>{selectedCommit.message.split('_summEnd_')[1].trim()}</p>
                    </>
                  ) : (
                    <>
                      <h3>Кратко:</h3>
                      <p>{selectedCommit.message.trim()}</p>
                    </>
                  )}

                  {selectedCommit.details && <pre>{selectedCommit.details}</pre>}
                  {showPluginsInDetails && <pre>{getSelectedCommitPluginsText()}</pre>}
                </>
              ) : (
                <p>Выберите коммит для просмотра деталей</p>
              )}
            </div>
          </div>
        </div>
        {showLogin && <LoginWindow
          onClose={handleCloseLogin}
          serverPath={serverPath}
        />}

        {showCreateRepo && (
          <CreateRepo
            serverPath={serverPath}
            user={user}
            onClose={() => setShowCreateRepo(false)}
            onCreate={handleCreateRepo}
          />
        )}

        {showSettings && (
          <SettingsWindow
            initialServerPath={serverPath}
            onClose={() => setShowSettings(false)}
            onSave={(nextServerPath) => {
              setServerPath(nextServerPath);
              localStorage.setItem('serverPath', nextServerPath);
            }}
            onRunDiagnostics={() => runFullDiagnostics()}
          />
        )}

        {showRepoPicker && (
          <RepoPicker
            repos={repos}
            selectedFullName={selectedRepo}
            isLoading={isLoadingRepos}
            onClose={() => setShowRepoPicker(false)}
            onSelect={(fullName) => handleSelectRepo(fullName)}
            onUpdate={handleRefreshRepo}
          />
        )}

        {isFlpProcessing && (
          <div className="flp-processing-overlay" role="status" aria-live="polite">
            <div className="flp-processing-card">
              <div className="flp-processing-spinner" aria-hidden="true" />
              <div className="flp-processing-title">Обработка файла</div>
              <div className="flp-processing-text">{flpProcessingMessage}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;