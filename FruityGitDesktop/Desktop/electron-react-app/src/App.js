// src/App.js
import React, { useState } from 'react';
import './App.css';

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

  // Заглушки для обработчиков событий
  const handleLogin = () => console.log('Login clicked');
  const handleAttachFile = async () => {
    const { ipcRenderer } = window.require('electron');
    const { spawn } = window.require('child_process');
    const path = window.require('path');

    try {
      const filePath = await ipcRenderer.invoke('open-flp-dialog');
      if (!filePath) return;

      // Для Electron >= 14 используем ipcRenderer.invoke для получения пути
      const appPath = await ipcRenderer.invoke('get-app-path');

      const pythonScriptPath = path.join(
        appPath,
        'resources',
        'python-app',
        'dist',
        'flp_processor.exe'
      );

      console.log('Python script path:', pythonScriptPath);

      // Проверка существования файла
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

      const formData = new FormData();
      const { ipcRenderer } = window.require('electron');

      // Получаем содержимое файла как Buffer
      const fileContent = await ipcRenderer.invoke('read-file', attachedFile);
      if (!fileContent) {
        throw new Error('Не удалось прочитать файл');
      }

      // Создаем Blob из содержимого файла
      const fileBlob = new Blob([fileContent]);
      const fileName = attachedFile.split(/[\\/]/).pop();

      formData.append('file', fileBlob, fileName);
      formData.append('summary', summary);
      formData.append('description', description);
      formData.append('userName', 'defaultUser');
      formData.append('userEmail', 'default@email.com');

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


  const handleCreateRepo = async () => {
    if (!repoName) {
      alert('Введите название репозитория');
      return;
    }
    try {
      const response = await fetch(`${serverPath}/api/git/${encodeURIComponent(repoName)}/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Ошибка при создании репозитория');
      }
      alert('Репозиторий успешно создан!');
      // Optionally refresh repo list here
    } catch (error) {
      alert(error.message);
    }
  };

  const handleShowRepo = async () => {
    if (!selectedRepo) {
      alert('Выберите репозиторий');
      return;
    }

    try {
      const response = await fetch(`${serverPath}/api/git/${encodeURIComponent(selectedRepo)}/history`);

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
              rawCommit: commit, // Store the original commit string
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
    setIsLoadingRepos(true);
    try {
      const response = await fetch(`${serverPath}/api/git/repositories`);

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

  // Заглушка для данных
  const mockCommits = [
    { id: 1, message: "Initial commit", date: "2023-06-15", details: "First commit details..." },
    { id: 2, message: "Added new feature", date: "2023-06-18", details: "Feature implementation details..." },
  ];

  return (
    <div className="app-container">
      {/* Top Bar */}
      <div className="top-bar">
        <button className="login-button" onClick={handleLogin}>
          Login
        </button>
      </div>

      <div className="main-grid">
        {/* Left Side - Column 0 */}
        <div className="left-column">
          {/* Attach File Section */}
          <div className="section">
            <button className="action-button" onClick={handleAttachFile}>
              Прикрепить файл
            </button>

            {attachedFile && (
              <div className="attached-file-info">Прикреплён: {attachedFile}</div>
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

            <button className="repo-action-button" onClick={handleCreateRepo}>
              Создать репозиторий
            </button>

            <div className="repo-list-container">
              <ul className="repo-list">
                {repos.map((repo, index) => (
                  <li
                    key={index}
                    className={repo === selectedRepo ? 'selected-repo' : ''}
                    onClick={() => setSelectedRepo(repo)}
                  >
                    {repo}
                  </li>
                ))}
                {repos.length === 0 && <li>Нет репозиториев</li>}
              </ul>
            </div>

            <div className="repo-buttons">
              <button className="repo-action-button" onClick={handleShowRepo}>
                Просмотреть репозиторий
              </button>
              <button className="repo-action-button" onClick={handleRefreshRepo} disabled={isLoadingRepos}>
                {isLoadingRepos ? 'Загрузка...' : 'Обновить'}
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
      </div>
    </div>
  );
}

export default App;