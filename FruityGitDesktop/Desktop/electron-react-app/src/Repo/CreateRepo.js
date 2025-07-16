import React, { useState } from 'react';
import './CreateRepo.css';
import { getAccessToken, refreshAuthToken } from '../Login/AuthService';

function CreateRepo({ serverPath, onClose, onCreate, user, handleLogout }) {
  const [repoName, setRepoName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchWithAuth = async (url, options = {}, isRetry = false) => {
    const accessToken = getAccessToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(accessToken && { 'Authorization': `Bearer ${accessToken}` }),
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!user || !user.id) {
      setError('User information is incomplete');
      return;
    }

    if (!repoName.trim()) {
      setError('Repository name is required');
      return;
    }

    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(repoName)) {
      setError('Repository name must be 1-100 characters (letters, numbers, hyphens, underscores)');
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetchWithAuth(
        `${serverPath}/api/git/${encodeURIComponent(repoName)}/init`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            IsPrivate: isPrivate,
            UserId: user.id
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.message ||
          (response.status === 400 ? 'Repository already exists' : 'Failed to create repository');
        throw new Error(errorMessage);
      }

      const result = await response.json();
      setRepoName('');
      setIsPrivate(false);
      onClose();
      onCreate({
        name: result.RepositoryName,
        isPrivate: result.IsPrivate,
        path: result.Path,
        author: user.name
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
          <h2>Create New Repository</h2>
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
              <label htmlFor="repo-name">Repository Name:</label>
              <input
                id="repo-name"
                type="text"
                value={repoName}
                onChange={(e) => {
                  setRepoName(e.target.value);
                  setError('');
                }}
                placeholder="my-repository"
                required
                disabled={isCreating}
                maxLength={100}
              />
              <div className="hint">
                1-100 characters (letters, numbers, hyphens, underscores)
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
                <span className="checkbox-label">Private Repository</span>
                <div className="hint">
                  Only you will be able to see and access this repository
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
                Cancel
              </button>
              <button
                type="submit"
                className="create-button"
                disabled={isCreating || !repoName.trim()}
              >
                {isCreating ? 'Creating...' : 'Create Repository'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CreateRepo;