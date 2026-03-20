// src/App.js

import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import LoginWindow from './Login/Login';
import { GitService } from './Git/GitService';
import CreateRepo from './Repo/CreateRepo';
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
  const serverPath = 'http://localhost:3000';
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
      throw new Error('Unable to determine local repository remote. Please select the correct folder.');
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
      throw new Error('Invalid repository reference');
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
      throw new Error('Selected folder is not empty and does not contain a git repository for this project.');
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
    if (!response.ok) throw new Error('Failed to get repository info');
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
        alert('Please login first');
        return;
      }

      if (!selectedRepo) {
        alert('Please select a repository first');
        return;
      }

      const filePath = await window.electronAPI.openFlpDialog();
      if (!filePath) return;

      const stageFileInLocalRepo = async (sourcePath, localPath) => {
        const fileContent = await window.electronAPI.readFile(sourcePath);
        if (!fileContent) {
          throw new Error('Failed to read file');
        }

        const fileName = sourcePath.split(/[\\/]/).pop();
        const destinationPath = window.electronAPI.pathJoin(localPath, 'uploads', fileName);
        await window.electronAPI.mkdir(window.electronAPI.pathDirname(destinationPath), { recursive: true });
        await window.electronAPI.writeFile(destinationPath, fileContent);

        const addResult = await window.electronAPI.git.add(localPath, destinationPath);
        if (!addResult.success) {
          throw new Error(addResult.error || 'Failed to stage file');
        }

        return destinationPath;
      };

      if (processWithPython) {
        // Call IPC to run Python in main
        const zipPath = await window.electronAPI.runPythonProcessor(filePath);
        const localPath = await ensureLocalRepoFor(selectedRepo, user.name);
        if (!localPath) {
          alert('Please select a folder to clone the repository');
          return;
        }

        // Extract ZIP into the repo and stage extracted contents (not the ZIP file)
        const zipBaseName = window.electronAPI.pathBasename(zipPath).replace(/\.zip$/i, '');
        // Use a stable folder per FLP to avoid re-adding the whole tree each upload.
        // This allows git to show only real added/deleted/modified files.
        const extractTo = window.electronAPI.pathJoin(localPath, 'uploads', zipBaseName);

        // Replace existing extracted project contents (if any).
        await window.electronAPI.rmrf(extractTo);
        await window.electronAPI.mkdir(extractTo, { recursive: true });
        await window.electronAPI.extractZip(zipPath, extractTo);

        const addResult = await window.electronAPI.git.add(localPath, extractTo);
        if (!addResult.success) {
          throw new Error(addResult.error || 'Failed to stage extracted files');
        }

        setAttachedFile(extractTo);
        alert('Archive extracted and added to local repository. Click Commit to create a commit.');
        return extractTo;
      } else {
        const localPath = await ensureLocalRepoFor(selectedRepo, user.name);
        if (!localPath) {
          alert('Please select a folder to clone the repository');
          return;
        }
        const stagedPath = await stageFileInLocalRepo(filePath, localPath);
        setAttachedFile(stagedPath);
        alert('File added to local repository. Click Commit to create a commit.');
        return stagedPath;
      }
    } catch (error) {
      console.error('Error processing FLP file:', error);
      alert(`Ошибка: ${error.message}`);
    }
  };

  const handleCreateRepo = (repoData) => {
    setShowCreateRepo(false);
    handleRefreshRepo();
  };

  const handleSend = async () => {
    try {
      if (!selectedRepo) {
        alert('Please select a repository first');
        return;
      }

      if (!user) {
        alert('Please login first');
        return;
      }

      if (!localRepoPath) {
        alert('Please select a local repository');
          return;
        }

      await GitService.pushToServer(localRepoPath, 'main');

      alert('Changes successfully pushed to remote repository!');
      await handleShowRepo(selectedRepo);
    } catch (error) {
      console.error('Send error:', error);
      alert(`Error: ${error.message}`);
      throw error;
    }
  };

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
        alert('Please select a folder to clone the repository');
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
      alert('Please select a remote repository first');
      return;
    }

    try {
      const folderPath = await window.electronAPI.openFolderDialog();
      if (!folderPath) return;
      if (!user) {
        throw new Error('Please login first');
      }

      const { owner, name, fullName } = parseRepoRef(selectedRepo, user?.name);
      if (!name || !owner) {
        throw new Error('Invalid repository selection');
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
        throw new Error('Selected folder is not empty and does not contain a git repository for this project.');
      }

      const repoInfo = await getRepoInfo(owner, name);
      const giteaRepoUrl = normalizeCloneUrl(repoInfo.clone_url);
      await GitService.cloneRepo(giteaRepoUrl, candidateSubRepoPath, user);

      setRepoPathMap(prev => ({ ...prev, [name]: candidateSubRepoPath, [fullName]: candidateSubRepoPath }));
      setLocalRepoPath(candidateSubRepoPath);
    } catch (error) {
      console.error('Error choosing folder:', error);
      alert(`Error: ${error.message}`);
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

      const mergedRefs = [...ownRepos, ...publicRepos]
        .map(r => r.full_name || `${r.owner?.login || user.name}/${r.name}`)
        .filter(Boolean);

      setRepos([...new Set(mergedRefs)]);
    } catch (error) {
      console.error('Refresh repo error:', error);
      alert(error.message);
    } finally {
      setIsLoadingRepos(false);
    }
  }, [user]);

  const handleRunDiagnostics = async () => {
    if (isRunningDiagnostics) return;
    setIsRunningDiagnostics(true);

    const lines = [];
    const addLine = (label, ok, details = '') => {
      const status = ok ? 'OK' : 'FAIL';
      lines.push(`${status} | ${label}${details ? ` | ${details}` : ''}`);
    };

    try {
      try {
        const response = await fetchWithTimeout(`${serverPath}/health`);
        addLine('Backend health endpoint', response.ok, `HTTP ${response.status}`);
      } catch (error) {
        addLine('Backend health endpoint', false, error.message);
      }

      try {
        const response = await fetchWithTimeout(`${serverPath}/gitea/api/v1/version`);
        addLine('Gitea proxy endpoint', response.ok, `HTTP ${response.status}`);
      } catch (error) {
        addLine('Gitea proxy endpoint', false, error.message);
      }

      const giteaToken = getGiteaToken();
      addLine('Gitea token in localStorage', !!giteaToken, giteaToken ? 'present' : 'missing');

      if (giteaToken) {
        try {
          const response = await fetchWithTimeout(`${serverPath}/gitea/api/v1/user`, {
            headers: {
              'Authorization': `token ${giteaToken}`,
              'X-Gitea-Token': giteaToken
            }
          });
          addLine('Gitea auth check (/api/v1/user)', response.ok, `HTTP ${response.status}`);
        } catch (error) {
          addLine('Gitea auth check (/api/v1/user)', false, error.message);
        }
      }

      try {
        await GitService.checkGitInstalled();
        addLine('Git installed', true);
      } catch (error) {
        addLine('Git installed', false, error.message);
      }

      if (localRepoPath) {
        addLine('Local repository selected', true, localRepoPath);
        const remotesResult = await window.electronAPI.git.getRemotes(localRepoPath);
        if (remotesResult.success) {
          const origin = remotesResult.remotes?.find(r => r.name === 'origin');
          if (origin) {
            const pushUrl = origin.refs?.push || origin.refs?.fetch || 'unknown';
            addLine('Origin remote', true, pushUrl);
          } else {
            addLine('Origin remote', false, 'origin not found');
          }
        } else {
          addLine('Origin remote', false, remotesResult.error || 'failed to read remotes');
        }
      } else {
        addLine('Local repository selected', false, 'not selected');
      }
    } finally {
      setIsRunningDiagnostics(false);
    }

    alert(`Diagnostics report:\n\n${lines.join('\n')}`);
  };

  const handleAllowUser = async () => {
    if (!user) {
      alert('Please login first');
      return;
    }

    if (!selectedRepo) {
      alert('Please select a repository first');
      return;
    }

    const email = allowUserEmail.trim();
    if (!email) {
      alert('Please enter an email');
      return;
    }

    const { owner, name } = parseRepoRef(selectedRepo, user.name);
    if (!owner || !name) {
      alert('Invalid repository selection');
      return;
    }

    if (owner.toLowerCase() !== (user.name || '').toLowerCase()) {
      alert('Only repository owner can allow contributors.');
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
        throw new Error(payload?.message || payload?.Message || 'Failed to allow user');
      }

      setAllowUserEmail('');
      alert(payload?.message || payload?.Message || 'User now has push access');
    } catch (error) {
      console.error('Allow user error:', error);
      alert(`Failed to allow user: ${error.message}`);
    } finally {
      setIsAllowingUser(false);
    }
  };

  const handleCommitSelect = (commit) => {
    if (!commit) return;

    const formatCommitMessage = (message) => {
      if (message.includes('_summEnd_')) {
        const [summary, description] = message.split('_summEnd_');
        return `Summary: ${summary.trim()}\n\nDescription: ${description.trim()}`;
      }
      return `Summary: ${message.trim()}`;
    };

    const formatFileList = (label, files) => {
      const list = (files || []).filter(Boolean);
      if (list.length === 0) return `${label}: (none)`;
      return `${label}:\n${list.map(f => `- ${f}`).join('\n')}`;
    };

    setSelectedCommit({
      ...commit,
      formattedDetails: `Commit: ${commit.id}
Author: ${commit.author} <${commit.email}>
Date: ${new Date(commit.date).toLocaleString()}

${formatCommitMessage(commit.message)}

${formatFileList('Added', commit.addedFiles)}
${formatFileList('Deleted', commit.deletedFiles)}
${formatFileList('Modified', commit.modifiedFiles)}`
    });
  };


  const handleDownloadRepo = async () => {
    if (!selectedRepo || !user) {
      alert('Please select a repository and ensure you are logged in');
      return;
    }

    try {
      const clonePath = await ensureLocalRepoFor(selectedRepo, user.name);
      if (!clonePath) return;

      // Уведомляем пользователя об успешном клонировании
      alert(`Repository cloned to: ${clonePath}\nYou can zip it manually if needed.`);
    } catch (error) {
      console.error('Download error:', error);
      alert(`Download error: ${error.message}`);
    }
  };

  // Handle "Clone to Local" button
  const handleCloneToLocal = async () => {
    if (!selectedRepo || !user) {
      alert('Please select a repository and login first');
      return;
    }
    try {
      const localPath = await ensureLocalRepoFor(selectedRepo, user.name);
      if (!localPath) return;

      setIsLoadingRepos(true);
      const { name, fullName } = parseRepoRef(selectedRepo, user?.name);
      setRepoPathMap(prev => ({ ...prev, [name || selectedRepo]: localPath, [fullName || selectedRepo]: localPath }));
      setLocalRepoPath(localPath);
      alert(`Repository cloned to: ${localPath}`);
      const localCommits = await GitService.getLocalHistory(localPath);
      setCommits(localCommits);
    } catch (error) {
      console.error('Clone error:', error);
      alert(`Failed to clone: ${error.message}`);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  // Handle "Commit to Local" (instead of sending to server directly)
  const handleCommitToLocal = async () => {
    if (!localRepoPath || !summary) {
      alert('Please select a local repo and add a summary');
      return;
    }

    try {
      const statusResult = await window.electronAPI.git.status(localRepoPath);
      if (!statusResult.success) {
        throw new Error(statusResult.error || 'Failed to get repository status');
      }

      if (statusResult.status.isClean) {
        alert('No staged changes found. Use Attach file first.');
        return;
      }

      await GitService.commitStagedChanges(localRepoPath, summary, description, user);

      alert('File committed to local repository!');

      // Refresh local history view
      const localCommits = await GitService.getLocalHistory(localRepoPath);
      setCommits(localCommits);

      // Clear form
      setSummary('');
      setDescription('');
      setAttachedFile(null);

    } catch (error) {
      console.error('Local commit error:', error);
      alert(`Commit failed: ${error.message}`);
    }
  };

  // Handle "Push to Server" (sync local -> remote)
  const handlePushToServer = async () => {
    if (!localRepoPath) {
      alert('Please select a local repository');
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
            throw new Error(`No write permission for ${owner}/${name}. Current user can read but cannot push.`);
          }
        }
      }

      await GitService.pushToServer(localRepoPath, 'main');
      alert('Changes pushed to server successfully!');
      await handleRefreshRepo();
      if (selectedRepo) {
        await handleShowRepo(selectedRepo);
      }
    } catch (error) {
      console.error('Push error:', error);
      if (error?.message?.includes('User permission denied for writing')) {
        alert('Push failed: current account has read-only access to this repository. Ask repo owner to grant Write permission or use a token from a user with push access.');
      } else {
        alert(`Push failed: ${error.message}`);
      }
    } finally {
      setIsLoadingRepos(false);
    }
  };


  // Handle "Pull from Server" (sync remote -> local)
  const handlePullFromServer = async () => {
    if (!localRepoPath) {
      alert('Please select a local repository first');
      return;
    }

    try {
      setIsLoadingRepos(true);
      await GitService.pullFromServer(localRepoPath, 'main');
      alert('Pulled latest changes from server');

      // Refresh local history
      const localCommits = await GitService.getLocalHistory(localRepoPath);
      setCommits(localCommits);
    } catch (error) {
      console.error('Pull error:', error);
      alert(`Pull failed: ${error.message}`);
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
  }, [user, handleRefreshRepo]);
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

  return (
    <div className="app-container">
      {/* Top Bar */}
      <div className="top-bar">
        {user ? (
          <div className="user-info">
            <span>Logged in as: {user.name || user.email}</span>
            <button className="logout-button" onClick={() => {
              setUser(null);
              localStorage.removeItem('user');
              clearAppState();  // Add this line
            }}>
              Logout
            </button>
          </div>
        ) : (
          <button className="login-button" onClick={handleLogin}>
            Login
          </button>
        )}
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

            <button className="send-button" onClick={handleSend}>
              Отправить
            </button>
          </div>

          {/* Repository Section */}
          <div className="section">
            <div className="input-group">
              <label className="input-label">Название:</label>
              <input
                type="text"
                className="repo-input"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="Название репозитория"
              />
            </div>

            <button
              className="repo-action-button"
              onClick={() => setShowCreateRepo(true)}
            >
              Создать репозиторий
            </button>

            <div className="repo-list-container">
              <ul className="repo-list">
                {repos && repos.length > 0 ? (
                  repos.map((repo, index) => (
                    <li
                      key={index}
                      className={repo === selectedRepo ? 'selected-repo' : ''}
                      onClick={() => {
                        setSelectedRepo(repo);
                        handleShowRepo(repo);
                        const { name, fullName } = parseRepoRef(repo, user?.name);
                        setLocalRepoPath(repoPathMap[fullName] || repoPathMap[name] || null);
                      }}
                    >
                      {repo}
                    </li>
                  ))
                ) : (
                  <li>No repositories found</li>
                )}
              </ul>
            </div>

            <div className="repo-buttons">
              <button className="repo-action-button" onClick={handleRefreshRepo} disabled={isLoadingRepos}>
                {isLoadingRepos ? 'Загрузка...' : 'Обновить'}
              </button>
              <button
                className="repo-action-button"
                onClick={handleRunDiagnostics}
                disabled={isRunningDiagnostics}
                title="Check backend, Gitea proxy, auth token and local git remote"
              >
                {isRunningDiagnostics ? 'Checking...' : 'Diagnostics'}
              </button>
              <button
                className="repo-action-button"
                onClick={handleDownloadRepo}
                disabled={!selectedRepo}
              >
                Скачать с сервера
              </button>
              {selectedRepo && user && (() => {
                const { owner } = parseRepoRef(selectedRepo, user?.name);
                return owner && owner.toLowerCase() === (user?.name || '').toLowerCase();
              })() && (
                <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="email"
                    className="repo-input"
                    placeholder="Contributor email"
                    value={allowUserEmail}
                    onChange={(e) => setAllowUserEmail(e.target.value)}
                    disabled={isAllowingUser}
                    style={{ maxWidth: '260px' }}
                  />
                  <button
                    className="repo-action-button"
                    onClick={handleAllowUser}
                    disabled={isAllowingUser || !allowUserEmail.trim()}
                    title="Grant push permission to this user"
                  >
                    {isAllowingUser ? 'Allowing...' : 'Allow User'}
                  </button>
                </div>
              )}
              <div className="local-repo-selector">
                <span className="local-repo-label">
                  Local repo: {localRepoPath || "not chosen"}
                </span>
                <button
                  className="repo-action-button"
                  onClick={handleChooseLocalFolder}
                >
                  Choose
                </button>
                {selectedRepo && !localRepoPath && (
                  <div className="suggestion-message">
                    No local folder associated with this repository.
                    <button
                      className="repo-action-button small"
                      onClick={handleChooseLocalFolder}
                    >
                      Create Local Folder
                    </button>
                  </div>
                )}
                {selectedRepo && localRepoPath && (
                  <div className="local-repo-actions">
                    <button
                      className="repo-action-button small"
                      onClick={handleChooseLocalFolder}
                    >
                      Change Local Folder
                    </button>
                  </div>
                )}
                <div className="git-sync-buttons" style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    className="repo-action-button"
                    onClick={handleCloneToLocal}
                    disabled={!selectedRepo || isLoadingRepos}
                    title="Clone remote repo to local folder"
                  >
                    📥 Clone to Local
                  </button>

                  {localRepoPath && (
                    <>
                      <button
                        className="repo-action-button"
                        onClick={handleCommitToLocal}
                        disabled={!summary}
                        title="Commit staged changes to local repo"
                      >
                        💾 Commit
                      </button>

                      <button
                        className="repo-action-button"
                        onClick={handlePullFromServer}
                        disabled={isLoadingRepos}
                        title="Pull latest from server"
                      >
                        ⬇️ Pull
                      </button>

                      <button
                        className="repo-action-button"
                        onClick={handlePushToServer}
                        disabled={isLoadingRepos}
                        title="Push local changes to server"
                      >
                        ⬆️ Push
                      </button>
                    </>
                  )}
                </div>

                {gitError && (
                  <div className="git-error-banner" style={{
                    background: '#fff3cd',
                    border: '1px solid #ffc107',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    marginTop: '10px',
                    fontSize: '0.9em'
                  }}>
                    ⚠️ {gitError}
                    <a href="https://git-scm.com/downloads" target="_blank" rel="noopener noreferrer" style={{ marginLeft: '8px' }}>
                      Install Git
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
                <li>No commits found</li>
              )}
            </ul>
          </div>

          {/* Details Section */}
          <div className="section details-section">
            <h2 className="section-title">Детали</h2>
            <div className="commit-details">
              {selectedCommit?.formattedDetails ? (
                <pre>{selectedCommit.formattedDetails}</pre>
              ) : selectedCommit ? (
                <>
                  <div className="commit-header">
                    <p>Commit: {selectedCommit.id}</p>
                    <p>Author: {selectedCommit.author} &lt;{selectedCommit.email}&gt;</p>
                    <p>Date: {new Date(selectedCommit.date).toLocaleString()}</p>
                  </div>

                  {selectedCommit.message.includes('_summEnd_') ? (
                    <>
                      <h3>Summary:</h3>
                      <p>{selectedCommit.message.split('_summEnd_')[0].trim()}</p>
                      <h3>Description:</h3>
                      <p>{selectedCommit.message.split('_summEnd_')[1].trim()}</p>
                    </>
                  ) : (
                    <>
                      <h3>Summary:</h3>
                      <p>{selectedCommit.message.trim()}</p>
                    </>
                  )}

                  {selectedCommit.details && <pre>{selectedCommit.details}</pre>}
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
      </div>
    </div>
  );
}

export default App;