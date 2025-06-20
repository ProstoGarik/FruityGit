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

  // Заглушки для обработчиков событий
  const handleLogin = () => console.log('Login clicked');
  const handleAttachFile = () => console.log('Attach file clicked');
  const handleSend = () => console.log('Send clicked');
  const handleCreateRepo = () => console.log('Create repo clicked');
  const handleShowRepo = () => console.log('Show repo clicked');
  const handleRefreshRepo = () => console.log('Refresh repo clicked');
  
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
                <li>Repo 1</li>
                <li>Repo 2</li>
                <li>Repo 3</li>
              </ul>
            </div>
            
            <div className="repo-buttons">
              <button className="repo-action-button" onClick={handleShowRepo}>
                Просмотреть репозиторий
              </button>
              <button className="repo-action-button" onClick={handleRefreshRepo}>
                Обновить
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
              {mockCommits.map(commit => (
                <li 
                  key={commit.id} 
                  className="commit-item"
                  onClick={() => setSelectedCommit(commit)}
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
              {selectedCommit ? (
                <>
                  <h3>{selectedCommit.message}</h3>
                  <p>{selectedCommit.date}</p>
                  <pre>{selectedCommit.details}</pre>
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