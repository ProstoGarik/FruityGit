import React, { useState } from 'react';
import './CreateRepo.css';
import { fetchWithGitea } from '../Login/AuthService';

function CreateRepo({ onClose, onCreate, user, serverPath }) {
  const [repoName, setRepoName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const normalizeCloneUrl = (cloneUrl) => {
    if (!cloneUrl) return cloneUrl;
    try {
      const clone = new URL(cloneUrl);
      const server = new URL(serverPath);
      const normalizedPath = clone.pathname.startsWith('/gitea/')
        ? clone.pathname
        : `/gitea${clone.pathname.startsWith('/') ? clone.pathname : `/${clone.pathname}`}`;
      return `${server.origin}${normalizedPath}`;
    } catch (err) {
      return cloneUrl;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!user || !user.name) {
      setError('Требуется информация о пользователе');
      return;
    }

    if (!repoName.trim()) {
      setError('Требуется имя репозитория');
      return;
    }

    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(repoName)) {
      setError('Имя репозитория: 1-100 символов (буквы, цифры, дефисы, подчёркивания)');
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetchWithGitea(`${serverPath}/gitea/api/v1/user/repos`, {
        method: 'POST',
        body: JSON.stringify({
          name: repoName,
          private: isPrivate,
          auto_init: true,
          default_branch: 'main'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Не удалось создать репозиторий');
      }

      const newRepo = await response.json();

      setRepoName('');
      setIsPrivate(false);
      onClose();

      onCreate({
        name: newRepo.name,
        isPrivate: newRepo.private,
        cloneUrl: normalizeCloneUrl(newRepo.clone_url),
        htmlUrl: newRepo.html_url,
        ...newRepo
      });

    } catch (err) {
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="create-repo-modal-overlay">
      <div className="create-repo-modal">
        <div className="create-repo-header">
          <h2>Создать новый репозиторий</h2>
          <button
            className="close-button"
            onClick={onClose}
            disabled={isCreating}
          >
            &times;
          </button>
        </div>

        <div className="create-repo-content">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="repo-name">Имя репозитория:</label>
              <input
                id="repo-name"
                type="text"
                value={repoName}
                onChange={(e) => {
                  setRepoName(e.target.value);
                  setError('');
                }}
                placeholder="мой-репозиторий"
                required
                disabled={isCreating}
                maxLength={100}
              />
              <div className="hint">
                1-100 символов (буквы, цифры, дефисы, подчёркивания)
              </div>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={() => setIsPrivate(!isPrivate)}
                  disabled={isCreating}
                />
                <span className="checkbox-label">Приватный репозиторий</span>
                <div className="hint">
                  Этот репозиторий будет виден и доступен только вам
                </div>
              </label>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="button-group">
              <button
                type="button"
                className="cancel-button"
                onClick={onClose}
                disabled={isCreating}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="create-button"
                disabled={isCreating || !repoName.trim()}
              >
                {isCreating ? 'Создание...' : 'Создать репозиторий'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreateRepo;