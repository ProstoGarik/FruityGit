// src/App.js
import React, { useState, useEffect } from 'react';
import './App.css';
import LoginWindow from './Login/Login';
import CreateRepo from './Repo/CreateRepo';
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  refreshAuthToken
} from './Login/AuthService';

function App() {
  const [repoName, setRepoName] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [repos, setRepos] = useState([]);
  const [commits, setCommits] = useState([]);
  const [selectedCommit, setSelectedCommit] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const serverPath = 'http://192.168.1.54:8081';
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [processWithPython, setProcessWithPython] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [user, setUser] = useState(null);
  const [showCreateRepo, setShowCreateRepo] = useState(false);
  

  const fetchWithAuth = async (url, options = {}, isRetry = false) => {
    const accessToken = getAccessToken();

    // Only set JSON content type if not FormData and not already specified
    const isFormData = options.body instanceof FormData;
    const defaultHeaders = {
      ...(!isFormData && { 'Content-Type': 'application/json' }), // Only set for non-FormData
      ...(accessToken && { 'Authorization': `Bearer ${accessToken}` })
    };

    // Merge headers - options.headers takes precedence
    const headers = {
      ...defaultHeaders,
      ...options.headers
    };

    let response = await fetch(url, { ...options, headers });

    if (response.status === 401 && !isRetry) {
      const newToken = await refreshAuthToken(serverPath);
      if (newToken) {
        headers.Authorization = `Bearer ${newToken}`;
        return fetchWithAuth(url, { ...options, headers }, true);
      } else {
        handleLogout();
        throw new Error('Session expired. Please login again.');
      }
    }

    return response;
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
    const { ipcRenderer } = window.require('electron');
    const path = window.require('path');

    try {
      const filePath = await ipcRenderer.invoke('open-flp-dialog');
      if (!filePath) return;

      if (processWithPython) {
        // Python processing mode
        const { spawn } = window.require('child_process');
        const appPath = await ipcRenderer.invoke('get-app-path');

        const pythonScriptPath = path.join(
          appPath,
          'resources',
          'python-app',
          'dist',
          'flp_processor.exe'
        );

        console.log('Python script path:', pythonScriptPath);

        const fs = window.require('fs');
        if (!fs.existsSync(pythonScriptPath)) {
          throw new Error(`FLP processor not found at: ${pythonScriptPath}`);
        }

        const pythonProcess = spawn(pythonScriptPath, [filePath]);

        pythonProcess.stdout.on('data', (data) => {
          console.log(`Python stdout: ${data}`);
        });

        pythonProcess.stderr.on('data', (data) => {
          console.error(`Python stderr: ${data}`);
        });

        pythonProcess.on('close', (code) => {
          if (code === 0) {
            console.log('Python script completed successfully');
            const zipPath = filePath.replace(/\.flp$/, '.zip');
            setAttachedFile(zipPath);
          } else {
            console.error(`Python script exited with code ${code}`);
            alert('Ошибка обработки FLP-файла');
          }
        });
      } else {
        // Direct attach mode
        setAttachedFile(filePath);
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

      const formData = new FormData();
      const { ipcRenderer } = window.require('electron');

      // Read file content
      const fileContent = await ipcRenderer.invoke('read-file', attachedFile);
      if (!fileContent) {
        throw new Error('Failed to read file');
      }

      // Create file with proper filename
      const fileName = attachedFile.split(/[\\/]/).pop();
      const file = new File([fileContent], fileName, { type: 'application/octet-stream' });

      // Append the file
      formData.append('File', file);

      // Append other fields
      formData.append('Summary', summary);
      formData.append('Description', description || ''); // Ensure description is sent even if empty

      // Append user info as separate fields with proper naming
      formData.append('UserInfo.Id', user.id);
      formData.append('UserInfo.Name', user.name);
      formData.append('UserInfo.Email', user.email);

      const response = await fetchWithAuth(
        `${serverPath}/api/git/${encodeURIComponent(selectedRepo)}/commit`,
        {
          method: 'POST',
          body: formData,
          // Don't set Content-Type header - let the browser set it automatically
          // with the proper boundary for multipart/form-data
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Commit failed: ${error.message || JSON.stringify(error)}`);
      }

      const result = await response.json();
      alert('File successfully committed!');
      setSummary('');
      setDescription('');
      setAttachedFile(null);
      handleShowRepo(selectedRepo);
      return result;
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
  };


  const handleShowRepo = async (repo) => {
    if (!repo || !user) return;

    try {
      const response = await fetchWithAuth(
        `${serverPath}/api/git/${encodeURIComponent(repo)}/history`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            Id: user.id,
            Name: user.name,
            Email: user.email
          }),
        }
      );

      if (response.status === 401) {
        alert("You don't have access to this private repository");
        return;
      }

      if (!response.ok) {
        throw new Error('Error getting commit history');
      }

      const historyData = await response.json();
      console.log('History response:', historyData); // Debug log

      const commitHistory = historyData.commits || [];

      // Process the commit history - extract summary from message
      const processedCommits = commitHistory.map((commit) => {
        const message = commit.message || '';
        const summary = message.includes('_summEnd_')
          ? message.split('_summEnd_')[0].trim()
          : message.trim();

        return {
          id: commit.id || '',  // Changed from commitId to id to match server response
          author: commit.author || '',
          message: message,     // Keep full message for details view
          summary: summary,      // Add summary for list view
          date: commit.date || new Date().toISOString(),
          email: commit.email || '',
          rawCommit: commit
        };
      });

      setCommits(processedCommits);
    } catch (error) {
      console.error('Show repo error:', error);
      alert(error.message);
    }
  };


  const handleRefreshRepo = async () => {
    if (!user) return;

    setIsLoadingRepos(true);
    try {
      const response = await fetchWithAuth(
        `${serverPath}/api/git/repositories`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            Id: user.id,
            Name: user.name,
            Email: user.email
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error getting repositories');
      }

      const data = await response.json();
      console.log('Server response:', data); // Keep this for debugging

      // Use the correct property name (lowercase 'repositories')
      setRepos(data.repositories || []); // Changed from data.Repositories to data.repositories
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
      const { ipcRenderer } = window.require('electron');
      const fs = window.require('fs');

      const savePath = await ipcRenderer.invoke('open-save-dialog', {
        defaultPath: `${selectedRepo}.zip`,
        filters: [{ name: 'ZIP Archives', extensions: ['zip'] }]
      });

      if (!savePath) return;

      const response = await fetchWithAuth(
        `${serverPath}/api/git/${encodeURIComponent(selectedRepo)}/download`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            Id: user.id,
            Name: user.name,
            Email: user.email
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Error downloading repository');
      }

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      fs.writeFileSync(savePath, buffer);
      alert(`Repository successfully downloaded: ${savePath}`);
    } catch (error) {
      console.error('Download error:', error);
      alert(`Download error: ${error.message}`);
    }
  };

  const handleSelectLocalFolder = async () => {
    if (!selectedRepo || !user) {
      alert('Пожалуйста, выберите репозиторий и убедитесь что вы авторизованы');
      return;
    }

    try {
      const { ipcRenderer } = window.require('electron');
      const path = window.require('path');
      const fs = window.require('fs');

      // Ask user to select folder
      const folderPath = await ipcRenderer.invoke('open-folder-dialog');

      if (!folderPath) return;

      // Create full path
      const repoFolder = path.join(folderPath, selectedRepo);

      // Check if folder exists
      if (fs.existsSync(repoFolder)) {
        const { response } = await ipcRenderer.invoke('show-message-box', {
          type: 'question',
          buttons: ['Да', 'Нет'],
          message: 'Папка уже существует',
          detail: `Папка ${repoFolder} уже существует. Перезаписать?`
        });

        if (response !== 0) return;
      }

      // Download the repository with user credentials
      const response = await fetchWithAuth(`${serverPath}/api/git/${encodeURIComponent(selectedRepo)}/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Id: user.id,  // Changed to capital case
          Name: user.name,  // Changed to capital case
          Email: user.email  // Changed to capital case
        }),
      });

      if (!response.ok) {
        throw new Error('Ошибка при скачивании репозитория');
      }

      // Save the repository
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Create the repo folder
      fs.mkdirSync(repoFolder, { recursive: true });

      // Save the zip file
      const zipPath = path.join(repoFolder, `${selectedRepo}.zip`);
      fs.writeFileSync(zipPath, buffer);

      // Extract the zip
      await ipcRenderer.invoke('extract-zip', zipPath, repoFolder);

      // Delete the zip file
      fs.unlinkSync(zipPath);

      alert(`Репозиторий успешно скачан и распакован в: ${repoFolder}`);
    } catch (error) {
      console.error('Download error:', error);
      alert(`Ошибка скачивания: ${error.message}`);
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
              <button
                className="repo-action-button"
                onClick={handleSelectLocalFolder}
                disabled={!selectedRepo}
              >
                Выбрать локальный репозиторий
              </button>
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