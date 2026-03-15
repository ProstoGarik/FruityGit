// src/App.js

import React, { useState, useEffect } from 'react';
import './App.css';
import LoginWindow from './Login/Login';
import { GitService } from './Git/GitService';
import CreateRepo from './Repo/CreateRepo';
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
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
  const [isGitChecking, setIsGitChecking] = useState(false);
  const [gitError, setGitError] = useState(null);



  const getRepoInfo = async (owner, repo) => {
    const response = await fetchWithGitea(`${serverPath}/gitea/api/v1/repos/${owner}/${repo}`, { method: 'GET' });
    if (!response.ok) throw new Error('Failed to get repository info');
    return response.json();
  };

  const handleLogin = () => {
    setShowLogin(true);
  };

  const handleLogout = async () => {
    try {
      // Call logout API if needed
      await fetch(`${serverPath}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAccessToken()}`
        },
        body: JSON.stringify({
          Email: user.email
        }),
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear all auth data
      clearTokens();
      localStorage.removeItem('user');
      setUser(null);
      clearAppState();
    }
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
      const filePath = await window.electronAPI.openFlpDialog();
      if (!filePath) return;

      if (processWithPython) {
        // Call IPC to run Python in main
        const zipPath = await window.electronAPI.runPythonProcessor(filePath);
        setAttachedFile(zipPath);
        return zipPath;
      } else {
        // Direct attach
        setAttachedFile(filePath);
        return filePath;
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

      if (!attachedFile) {
        alert('Please attach a file');
        return;
      }

      if (!summary) {
        alert('Please enter a summary');
        return;
      }

      if (!user) {
        alert('Please login first');
        return;
      }

      // Get local repo path or clone if needed
      let localPath = repoPathMap[selectedRepo];

      if (!localPath) {
        // Need to clone the repo first
        const clonePath = await window.electronAPI.openFolderDialog();
        if (!clonePath) {
          alert('Please select a folder to clone the repository');
          return;
        }

        // Get Gitea URL from server
        const repoInfo = await getRepoInfo(user.name, selectedRepo);
        const giteaRepoUrl = repoInfo.clone_url;

        // Clone using simple-git
        const cloneResult = await GitService.cloneRepo(giteaRepoUrl, clonePath, user);
        localPath = clonePath;
        setRepoPathMap(prev => ({ ...prev, [selectedRepo]: clonePath }));
        setLocalRepoPath(clonePath);
      }

      // Read file and copy to repo
      const fileContent = await window.electronAPI.readFile(attachedFile);
      if (!fileContent) {
        throw new Error('Failed to read file');
      }

      const fileName = attachedFile.split(/[\\/]/).pop();
      const filePath = window.electronAPI.pathJoin(localPath, fileName);

      // Write file to repo
      await window.electronAPI.writeFile(filePath, fileContent);

      // Commit using simple-git
      await GitService.commitFile(localPath, fileName, summary, description, user);

      // Push to Gitea
      await GitService.pushToServer(localPath, user);

      alert('File successfully committed and pushed to Gitea!');
      setSummary('');
      setDescription('');
      setAttachedFile(null);
      handleShowRepo(selectedRepo);
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
      // Проверяем, есть ли локальная копия
      const localPath = repoPathMap[repo];
      if (localPath) {
        const localCommits = await GitService.getLocalHistory(localPath);
        setCommits(localCommits);
        return;
      }

      // Если нет — предлагаем выбрать папку для клонирования
      const clonePath = await window.electronAPI.openFolderDialog();
      if (!clonePath) {
        alert('Please select a folder to clone the repository');
        return;
      }

      const repoInfo = await getRepoInfo(user.name, repo);
      const giteaRepoUrl = repoInfo.clone_url;
      await GitService.cloneRepo(giteaRepoUrl, clonePath, user); // user пока можно оставить, но он не используется
      setRepoPathMap(prev => ({ ...prev, [repo]: clonePath }));
      setLocalRepoPath(clonePath);

      const localCommits = await GitService.getLocalHistory(clonePath);
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
      if (folderPath) {
        // Update map and local state
        setRepoPathMap(prev => ({ ...prev, [selectedRepo]: folderPath }));
        setLocalRepoPath(folderPath);
      }
    } catch (error) {
      console.error('Error choosing folder:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const handleRefreshRepo = async () => {
    if (!user) return;

    setIsLoadingRepos(true);
    try {
      const response = await fetchWithGitea(`${serverPath}/gitea/api/v1/user/repos`, { method: 'GET' });
      const repos = await response.json();
      setRepos(repos.map(r => r.name));
    } catch (error) {
      console.error('Refresh repo error:', error);
      alert(error.message);
    } finally {
      setIsLoadingRepos(false);
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

    setSelectedCommit({
      ...commit,
      formattedDetails: `Commit: ${commit.id}
Author: ${commit.author} <${commit.email}>
Date: ${new Date(commit.date).toLocaleString()}

${formatCommitMessage(commit.message)}`
    });
  };


  const handleDownloadRepo = async () => {
    if (!selectedRepo || !user) {
      alert('Please select a repository and ensure you are logged in');
      return;
    }

    try {
      // Запрашиваем у пользователя папку для сохранения репозитория
      const tempPath = await window.electronAPI.openFolderDialog();
      if (!tempPath) return;

      // Получаем информацию о репозитории из Gitea (clone_url и другие данные)
      const repoInfo = await getRepoInfo(user.name, selectedRepo);
      const giteaRepoUrl = repoInfo.clone_url;

      // Формируем полный путь клонирования: выбранная папка + имя репозитория
      const clonePath = window.electronAPI.pathJoin(tempPath, selectedRepo);

      // Клонируем репозиторий через GitService (токен автоматически подставляется)
      await GitService.cloneRepo(giteaRepoUrl, clonePath, user);

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
      const localPath = await window.electronAPI.openFolderDialog();
      if (!localPath) return;

      const repoInfo = await getRepoInfo(user.name, selectedRepo);
      const giteaRepoUrl = repoInfo.clone_url;

      setIsLoadingRepos(true);
      await GitService.cloneRepo(giteaRepoUrl, localPath, user);
      setRepoPathMap(prev => ({ ...prev, [selectedRepo]: localPath }));
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
    if (!localRepoPath || !attachedFile || !summary) {
      alert('Please select a local repo, attach a file, and add a summary');
      return;
    }

    try {
      // Copy file to local repo first (optional - or let user manage files)
      const fileName = attachedFile.split(/[\\/]/).pop();
      const destPath = window.electronAPI.pathJoin(localRepoPath, 'uploads', fileName);

      // Use your exposed fs to copy
      const fileContent = await window.electronAPI.readFile(attachedFile);
      await window.electronAPI.mkdir(window.electronAPI.pathDirname(destPath), { recursive: true });
      await window.electronAPI.writeFile(destPath, fileContent);

      // Commit via GitService
      await GitService.commitFile(
        localRepoPath,
        destPath,
        summary,
        description,
        user
      );

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
      await GitService.pushToServer(localRepoPath, 'main');
      alert('Changes pushed to server successfully!');
      await handleRefreshRepo();
      if (selectedRepo) {
        await handleShowRepo(selectedRepo);
      }
    } catch (error) {
      console.error('Push error:', error);
      alert(`Push failed: ${error.message}`);
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
  }, []);
  useEffect(() => {
    const checkGit = async () => {
      setIsGitChecking(true);
      try {
        await GitService.checkGitInstalled();
        setGitError(null);
      } catch (err) {
        setGitError(err.message);
        // Optionally show a helpful UI message
      } finally {
        setIsGitChecking(false);
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
                        setLocalRepoPath(repoPathMap[repo] || null);
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
                onClick={handleDownloadRepo}
                disabled={!selectedRepo}
              >
                Скачать с сервера
              </button>
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
                        disabled={!attachedFile || !summary}
                        title="Commit attached file to local repo"
                      >
                        💾 Commit Local
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