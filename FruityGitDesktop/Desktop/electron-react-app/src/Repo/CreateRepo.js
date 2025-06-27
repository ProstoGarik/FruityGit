// src/CreateRepo/CreateRepo.js
import React, { useState } from 'react';
import './CreateRepo.css';

function CreateRepo({ onClose, onCreate }) {
  const [repoName, setRepoName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!repoName.trim()) {
      alert('Please enter repository name');
      return;
    }
    onCreate({ name: repoName, isPrivate });
  };

  return (
    <div className="create-repo-modal">
      <div className="create-repo-content">
        <h2>Create New Repository</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Repository Name:</label>
            <input
              type="text"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value)}
              placeholder="my-repository"
              required
            />
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={() => setIsPrivate(!isPrivate)}
              />
              Private Repository
            </label>
          </div>
          <div className="button-group">
            <button type="button" className="cancel-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="create-button">
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateRepo;