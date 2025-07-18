import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const serverPath = "http://192.168.1.54:8081";
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [repos, setRepos] = useState([]);
  const [user, setUser] = useState(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showCreateRepo, setShowCreateRepo] = useState(false);
  const [repoName, setRepoName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [commits, setCommits] = useState([]);
  const [selectedCommit, setSelectedCommit] = useState(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Get access token from localStorage
  const getAccessToken = () => localStorage.getItem('accessToken');

  // Fetch with authentication handling
  const fetchWithAuth = async (url, options = {}, isRetry = false) => {
    const accessToken = getAccessToken();

    const isFormData = options.body instanceof FormData;
    const defaultHeaders = {
      ...(!isFormData && { 'Content-Type': 'application/json' }),
      ...(accessToken && { 'Authorization': `Bearer ${accessToken}` })
    };

    const headers = {
      ...defaultHeaders,
      ...options.headers
    };

    let response = await fetch(url, { ...options, headers });

    if (response.status === 401 && !isRetry) {
      const newToken = await refreshAuthToken();
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

  const refreshAuthToken = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      const response = await fetch(`${serverPath}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken })
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();
      localStorage.setItem('accessToken', data.token);
      return data.token;
    } catch (error) {
      console.error('Token refresh error:', error);
      return null;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');
    setUser(null);
    setRepos([]);
  };


  const handleCreateRepo = async (e) => {
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

    setIsLoading(true);

    try {
      const response = await fetchWithAuth(
        `${serverPath}/api/git/${encodeURIComponent(repoName)}/init`,
        {
          method: 'POST',
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
      setShowCreateRepo(false);

      // Refresh the repository list
      await handleRefreshRepo();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowRepo = async (repoName) => {
    if (!repoName || !user) return;

    setIsLoadingHistory(true);
    setSelectedRepo(repoName);
    setCommits([]);
    setSelectedCommit(null);

    try {
      const response = await fetchWithAuth(
        `${serverPath}/api/git/${encodeURIComponent(repoName)}/history`,
        {
          method: 'POST',
          body: JSON.stringify({
            Id: user.id,
            Name: user.name,
            Email: user.email
          }),
        }
      );

      if (response.status === 401) {
        setError("You don't have access to this private repository");
        return;
      }

      if (!response.ok) {
        throw new Error('Error getting commit history');
      }

      const historyData = await response.json();
      const commitHistory = historyData.commits || [];

      // Process the commit history - extract summary from message
      const processedCommits = commitHistory.map((commit) => {
        const message = commit.Message || commit.message || '';
        const summary = message.includes('_summEnd_')
          ? message.split('_summEnd_')[0].trim()
          : message.trim();

        return {
          id: commit.Id || commit.id || '',
          author: commit.Author || commit.author || '',
          message: message,
          summary: summary,
          date: commit.Date || commit.date || new Date().toISOString(),
          email: commit.Email || commit.email || '',
        };
      });

      setCommits(processedCommits);
    } catch (error) {
      console.error('Show repo error:', error);
      setError(error.message);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleCommitSelect = (commit) => {
    setSelectedCommit(commit);
  };

  const handleRefreshRepo = async () => {
    if (!user) return;

    setIsLoadingRepos(true);
    try {
      const response = await fetchWithAuth(
        `${serverPath}/api/git/repositories`,
        {
          method: 'POST',
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
      setRepos(data.repositories || []);
    } catch (error) {
      console.error('Refresh repo error:', error);
      setError(error.message);
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${serverPath}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Email: email,
          Password: password
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Store tokens and user info
      localStorage.setItem('accessToken', data.token);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('userId', data.user.id);
      localStorage.setItem('userName', data.user.userName);
      localStorage.setItem('userEmail', data.user.email);

      // Set user state
      setUser({
        id: data.user.id,
        name: data.user.userName,
        email: data.user.email
      });

      // Automatically fetch repositories after login
      await handleRefreshRepo();

    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');

    if (!name || !email || !password) {
      setError('Name, email and password are required');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${serverPath}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          UserName: name,  // Send username separately
          Email: email,
          Password: password,
          RoleName: 'User'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      // Store tokens and user info
      localStorage.setItem('accessToken', data.token);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('userId', data.user.id);
      localStorage.setItem('userName', data.user.userName); // Store the username
      localStorage.setItem('userEmail', data.user.email);

      // Set user state
      setUser({
        id: data.user.id,
        name: data.user.userName, // Use the username from response
        email: data.user.email
      });

      // Automatically fetch repositories after registration
      await handleRefreshRepo();

    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Check for existing session on initial load
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (userId) {
      setUser({
        id: userId,
        name: localStorage.getItem('userName'),
        email: localStorage.getItem('userEmail')
      });
      handleRefreshRepo();
    }
  }, []);

  return (
    <div className="dark-theme">
      {/* Navigation Bar */}
      <nav className="navbar">
        <div className="navbar-left">
          <div className="nav-links">
            <a href="/">Explore</a>
          </div>
        </div>
        <div className="navbar-right">
          {user ? (
            <button className="btn btn-logout" onClick={handleLogout}>Sign out</button>
          ) : (
            <>
              <button
                className={`btn ${!isRegistering ? 'btn-active' : 'btn-login'}`}
                onClick={() => setIsRegistering(false)}
              >
                Sign in
              </button>
              <button
                className={`btn ${isRegistering ? 'btn-active' : 'btn-register'}`}
                onClick={() => setIsRegistering(true)}
              >
                Sign up
              </button>
            </>
          )}
        </div>
      </nav>

      {user ? (
        <div className="dashboard-container">
          <h2>Welcome, {user.name}</h2>
          <div className="repositories-section">
            <div className="repositories-header">
              <h3>Your Repositories</h3>
              <div className="repo-actions">
                <button
                  className="btn btn-refresh"
                  onClick={handleRefreshRepo}
                  disabled={isLoadingRepos}
                >
                  {isLoadingRepos ? 'Refreshing...' : 'Refresh'}
                </button>
                <button
                  className="btn btn-create"
                  onClick={() => setShowCreateRepo(true)}
                  disabled={isLoadingRepos}
                >
                  Create Repository
                </button>
              </div>
            </div>

            {isLoadingRepos ? (
              <div className="loading">Loading repositories...</div>
            ) : repos.length > 0 ? (
              <ul className="repository-list">
                {repos.map((repo, index) => (
                  <li
                    key={index}
                    className="repository-item"
                    onClick={() => handleShowRepo(repo.name)}
                  >
                    <div className="repo-name">{repo.name}</div>
                    <div className="repo-description">{repo.description || 'No description'}</div>
                    <div className="repo-meta">
                      <span>Last updated: {new Date(repo.updatedAt).toLocaleString()}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="no-repositories">No repositories found</div>
            )}
          </div>
          {selectedRepo && (
            <div className="history-container">
              <h3>Commit History for {selectedRepo}</h3>

              {isLoadingHistory ? (
                <div className="loading">Loading commit history...</div>
              ) : (
                <div className="history-columns">
                  {/* Commit List */}
                  <div className="commit-list">
                    <h4>Commits</h4>
                    {commits.length > 0 ? (
                      <ul>
                        {commits.map(commit => (
                          <li
                            key={commit.id}
                            className={`commit-item ${selectedCommit?.id === commit.id ? 'selected' : ''}`}
                            onClick={() => handleCommitSelect(commit)}
                          >
                            <div className="commit-message">{commit.summary}</div>
                            <div className="commit-meta">
                              <span className="commit-author">{commit.author}</span>
                              <span className="commit-date">
                                {new Date(commit.date).toLocaleString()}
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div>No commits found</div>
                    )}
                  </div>

                  {/* Commit Details */}
                  <div className="commit-details">
                    <h4>Commit Details</h4>
                    {selectedCommit ? (
                      <div className="commit-detail-content">
                        <div className="commit-header">
                          <p><strong>Commit ID:</strong> {selectedCommit.id}</p>
                          <p><strong>Author:</strong> {selectedCommit.author} &lt;{selectedCommit.email}&gt;</p>
                          <p><strong>Date:</strong> {new Date(selectedCommit.date).toLocaleString()}</p>
                        </div>

                        <div className="commit-message-content">
                          {selectedCommit.message.includes('_summEnd_') ? (
                            <>
                              <h5>Summary:</h5>
                              <p>{selectedCommit.message.split('_summEnd_')[0].trim()}</p>
                              <h5>Description:</h5>
                              <p>{selectedCommit.message.split('_summEnd_')[1].trim()}</p>
                            </>
                          ) : (
                            <>
                              <h5>Message:</h5>
                              <p>{selectedCommit.message.trim()}</p>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>Select a commit to view details</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="signin-container">
          <div className="signin-box">
            <h2>{isRegistering ? 'Create an account' : 'Sign in to your account'}</h2>
            <form className="signin-form" onSubmit={isRegistering ? handleRegister : handleLogin}>
              {isRegistering && (
                <div className="form-group">
                  <label htmlFor="name">Name</label>
                  <input
                    type="text"
                    id="name"
                    className="form-input"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}
              <div className="form-group">
                <label htmlFor="email">Email address</label>
                <input
                  type="email"
                  id="email"
                  className="form-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="form-group">
                <div className="password-label-container">
                  <label htmlFor="password">Password</label>
                  {!isRegistering && (
                    <a href="/forgot" className="forgot-password">Forgot password?</a>
                  )}
                </div>
                <input
                  type="password"
                  id="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && <div className="error-message">{error}</div>}
              <button
                type="submit"
                className="btn btn-signin"
                disabled={isLoading}
              >
                {isLoading
                  ? (isRegistering ? 'Signing up...' : 'Signing in...')
                  : (isRegistering ? 'Sign up' : 'Sign in')}
              </button>
              <div className="toggle-auth">
                {isRegistering ? (
                  <p>
                    Already have an account?{' '}
                    <button type="button" className="toggle-auth-btn" onClick={() => setIsRegistering(false)}>
                      Sign in
                    </button>
                  </p>
                ) : (
                  <p>
                    Don't have an account?{' '}
                    <button type="button" className="toggle-auth-btn" onClick={() => setIsRegistering(true)}>
                      Sign up
                    </button>
                  </p>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
      {showCreateRepo && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>Create New Repository</h2>
              <button
                className="close-button"
                onClick={() => setShowCreateRepo(false)}
                disabled={isLoading}
              >
                &times;
              </button>
            </div>

            <div className="modal-content">
              <form onSubmit={handleCreateRepo}>
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
                    disabled={isLoading}
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
                      disabled={isLoading}
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
                    className="btn btn-cancel"
                    onClick={() => setShowCreateRepo(false)}
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-create"
                    disabled={isLoading || !repoName.trim()}
                  >
                    {isLoading ? 'Creating...' : 'Create Repository'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;