// src/Repo/CreateRepo.js
import React, { useState } from 'react';
import './CreateRepo.css';

function CreateRepo({ onClose, onCreate, user }) {
  const [repoName, setRepoName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);



  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!user) {
      setError('You must be logged in to create repositories');
      return;
    }

    // Validation
    if (!repoName.trim()) {
      setError('Repository name is required');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(repoName)) {
      setError('Only letters, numbers, hyphens and underscores allowed');
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch(`${serverPath}/api/git/${encodeURIComponent(repoName)}/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          UserName: user.name,
          UserEmail: user.email,
          IsPrivate: isPrivate
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.Error || 'Failed to create repository');
      }

      // Success
      setRepoName('');
      setIsPrivate(false);
      onClose();

      // Notify parent component
      onCreate({
        name: repoName,
        isPrivate,
        author: user.name
      });

      alert(`Repository "${repoName}" created successfully!`);
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
                Only letters, numbers, hyphens and underscores allowed
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