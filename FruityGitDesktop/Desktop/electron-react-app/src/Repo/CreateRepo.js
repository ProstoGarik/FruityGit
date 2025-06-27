// src/CreateRepo/CreateRepo.js
import React, { useState } from 'react';
import './CreateRepo.css';

function CreateRepo({ onClose, onCreate }) {
  const [repoName, setRepoName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const validateRepoName = (name) => {
    // Only allow alphanumeric, hyphens, and underscores
    return /^[a-zA-Z0-9_-]+$/.test(name);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!repoName.trim()) {
      setError('Repository name is required');
      return;
    }

    if (!validateRepoName(repoName)) {
      setError('Only letters, numbers, hyphens and underscores are allowed');
      return;
    }

    if (repoName.length > 100) {
      setError('Repository name must be less than 100 characters');
      return;
    }

    setIsCreating(true);
    try {
      await onCreate({ 
        name: repoName, 
        isPrivate 
      });
      // Reset form on successful creation
      setRepoName('');
      setIsPrivate(false);
    } catch (err) {
      setError(err.message || 'Failed to create repository');
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
                  Private repositories are only visible to you
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