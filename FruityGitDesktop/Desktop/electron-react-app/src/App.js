// src/App.js
import React, { useState, useEffect } from 'react';
import './App.css';
import LoginWindow from './Login/Login';
import CreateRepo from './Repo/CreateRepo';

function App() {
  const [repoName, setRepoName] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [repos, setRepos] = useState([]);
  const [commits, setCommits] = useState([]);
  const [selectedCommit, setSelectedCommit] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const serverPath = 'http://192.168.135.52:8000'; // TODO: update to your actual server path
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [processWithPython, setProcessWithPython] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [user, setUser] = useState(null);
  const [showCreateRepo, setShowCreateRepo] = useState(false);


  // Заглушки для обработчиков событий
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

  const handleSend = async () => {
    try {
      if (!selectedRepo) {
        alert('Пожалуйста, сначала выберите репозиторий');
        return;
      }

      if (!attachedFile) {
        alert('Пожалуйста, прикрепите файл');
        return;
      }

      if (!summary) {
        alert('Пожалуйста, введите краткое описание');
        return;
      }

      // Use logged-in user or default values
      const userName = user?.name || 'defaultUser';
      const userEmail = user?.email || 'default@email.com';

      const formData = new FormData();
      const { ipcRenderer } = window.require('electron');

      // Get file content
      const fileContent = await ipcRenderer.invoke('read-file', attachedFile);
      if (!fileContent) {
        throw new Error('Не удалось прочитать файл');
      }

      // Determine file name
      const fileName = processWithPython
        ? attachedFile.split(/[\\/]/).pop().replace('.flp', '.zip')
        : attachedFile.split(/[\\/]/).pop();

      // Create Blob with appropriate type
      const fileBlob = new Blob([fileContent], {
        type: processWithPython ? 'application/zip' : 'application/octet-stream'
      });

      formData.append('file', fileBlob, fileName);
      formData.append('summary', summary);
      formData.append('description', description);
      formData.append('userName', userName);
      formData.append('userEmail', userEmail);

      const response = await fetch(`${serverPath}/api/git/${encodeURIComponent(selectedRepo)}/commit`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        alert('Файл успешно закоммичен!');
        setSummary('');
        setDescription('');
        setAttachedFile(null);
        handleShowRepo();
      } else {
        const error = await response.text();
        throw new Error(`Ошибка при коммите файла: ${error}`);
      }
    } catch (error) {
      console.error('Send error:', error);
      alert(`Ошибка: ${error.message}`);
    }
  };


  const handleShowRepo = async (repo) => {
    if (!repo || !user) return;

    try {
      const response = await fetch(`${serverPath}/api/git/${encodeURIComponent(repo)}/history`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: user.id,
          name: user.name,
          email: user.email
        }),
      });

      if (!response.ok) {
        throw new Error('Ошибка при получении истории коммитов');
      }

      const commitHistory = await response.json();

      if (Array.isArray(commitHistory)) {
        const processedCommits = commitHistory.map((commit, index) => {
          const parts = commit.split(/ _idEnd_ | _usEnd_ | _summEnd_ | _descEnd_ /);
          return parts.length >= 4
            ? {
              id: index,
              message: `${parts[1]} - ${parts[2]}`,
              rawCommit: commit,
              date: parts.length >= 5 ? parts[4] : new Date().toISOString().split('T')[0]
            }
            : null;
        }).filter(Boolean);

        setCommits(processedCommits);
      } else {
        throw new Error('Некорректный формат данных коммитов');
      }
    } catch (error) {
      console.error('Show repo error:', error);
      alert(error.message);
    }
  };


  const handleRefreshRepo = async () => {
    if (!user) return;

    setIsLoadingRepos(true);
    try {
      const response = await fetch(`${serverPath}/api/git/repositories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: user.id,
          name: user.name,
          email: user.email
        }),
      });

      if (!response.ok) {
        throw new Error('Ошибка при получении списка репозиториев');
      }

      const repos = await response.json();

      if (Array.isArray(repos)) {
        setRepos(repos);
      } else {
        throw new Error('Некорректный формат данных репозиториев');
      }
    } catch (error) {
      console.error('Refresh repo error:', error);
      alert(error.message);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const handleCommitSelect = (commit) => {
    if (!commit) return;

    // Split the original commit string (assuming we stored it in rawCommit)
    const parts = commit.rawCommit?.split(/ _idEnd_ | _usEnd_ | _summEnd_ | _descEnd_ /) || [];

    if (parts.length >= 5) {
      const formattedDetails = `Commit: ${parts[0]}\nAuthor: ${parts[1]}\nDate: ${parts[4]}\n\nMessage:\n${parts[2]}\n\nDescription:\n${parts[3]}`;
      setSelectedCommit({
        ...commit,
        formattedDetails
      });
    } else {
      setSelectedCommit(commit);
    }
  };


  const handleDownloadRepo = async () => {
    if (!selectedRepo || !user) {
      alert('Пожалуйста, выберите репозиторий и убедитесь что вы авторизованы');
      return;
    }

    try {
      const { ipcRenderer } = window.require('electron');
      const fs = window.require('fs');

      // Ask user where to save
      const savePath = await ipcRenderer.invoke('open-save-dialog', {
        defaultPath: `${selectedRepo}.zip`,
        filters: [{ name: 'ZIP Archives', extensions: ['zip'] }]
      });

      if (!savePath) return;

      // Download the repository with user credentials
      const response = await fetch(`${serverPath}/api/git/${encodeURIComponent(selectedRepo)}/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: user.id,
          name: user.name,
          email: user.email
        }),
      });

      if (!response.ok) {
        throw new Error('Ошибка при скачивании репозитория');
      }

      // Convert response to blob
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Save file
      fs.writeFileSync(savePath, buffer);

      alert(`Репозиторий успешно скачан: ${savePath}`);
    } catch (error) {
      console.error('Download error:', error);
      alert(`Ошибка скачивания: ${error.message}`);
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
      const response = await fetch(`${serverPath}/api/git/${encodeURIComponent(selectedRepo)}/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: user.id,
          name: user.name,
          email: user.email
        }),
      });

      if (!response.ok) {
        throw new Error('Ошибка при скачивании репозитория');
      }
      // ... rest of the function remains the same
    } catch (error) {
      console.error('Download error:', error);
      alert(`Ошибка скачивания: ${error.message}`);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    handleRefreshRepo();
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
                {repos.map((repo, index) => (
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
                ))}
                {repos.length === 0 && <li>Нет репозиториев</li>}
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
              {commits.map(commit => (
                <li
                  key={commit.id}
                  className="commit-item"
                  onClick={() => handleCommitSelect(commit)}
                >
                  <div className="commit-message">{commit.message}</div>
                  <div className="commit-date">{commit.date}</div>
                </li>
              ))}
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
                  <h3>{selectedCommit.message}</h3>
                  <p>{selectedCommit.date}</p>
                  {selectedCommit.details && <pre>{selectedCommit.details}</pre>}
                </>
              ) : (
                <p>Выберите коммит для просмотра деталей</p>
              )}
            </div>
          </div>
        </div>
        {showLogin && <LoginWindow onClose={handleCloseLogin} />}

        {showCreateRepo && (
          <CreateRepo
            onClose={() => setShowCreateRepo(false)}
            onCreate={handleCreateRepo}
          />
        )}
      </div>
    </div>
  );
}

export default App;