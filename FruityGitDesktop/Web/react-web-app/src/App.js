import React, { useState, useEffect } from 'react';
import './App.css';
import flpIcon from './img/FruityLoopsLogo.png'; // Adjust the path to your actual PNG file

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
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [fileContent, setFileContent] = useState('');
  const [isLoadingFileContent, setIsLoadingFileContent] = useState(false);
  const [expandedCommits, setExpandedCommits] = useState({});
  const [expandedRepos, setExpandedRepos] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activeTab, setActiveTab] = useState('repositories'); // 'repositories' or 'search'
  const [isSearching, setIsSearching] = useState(false);
  const [viewedUserRepos, setViewedUserRepos] = useState([]);
  const [viewedUserEmail, setViewedUserEmail] = useState(null);
  const [viewedUser, setViewedUser] = useState(null);

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
        body: JSON.stringify({
          Token: refreshToken // Match the backend's RefreshTokenRequest format
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();
      localStorage.setItem('accessToken', data.Token); // Uppercase 'Token'
      return data.Token;
    } catch (error) {
      console.error('Token refresh error:', error);
      return null;
    }
  };

  const fetchRepositoryFiles = async (repoName, path = '') => {
    if (!repoName || !user) return;

    setIsLoadingFiles(true);
    setCurrentPath(path);
    setFiles([]);
    setFileContent('');

    try {
      const response = await fetchWithAuth(
        `${serverPath}/api/git/${encodeURIComponent(repoName)}/files`,
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
        throw new Error('Error getting repository files');
      }

      const data = await response.json();
      setFiles(data.files || []);
    } catch (error) {
      console.error('Error fetching repository files:', error);
      setError(error.message);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const fetchFileContent = async (repoName, filePath) => {
    if (!repoName || !filePath || !user) return;

    setIsLoadingFileContent(true);
    setFileContent('');

    try {
      const response = await fetchWithAuth(
        `${serverPath}/api/git/${encodeURIComponent(repoName)}/file`,
        {
          method: 'POST',
          body: JSON.stringify({
            Id: user.id,
            Name: user.name,
            Email: user.email,
            Path: filePath
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Error getting file content');
      }

      const data = await response.text();
      setFileContent(data);
    } catch (error) {
      console.error('Error fetching file content:', error);
      setError(error.message);
    } finally {
      setIsLoadingFileContent(false);
    }
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
    setFiles([]);
    setCurrentPath('');

    try {
      // Fetch commit history
      const historyResponse = await fetchWithAuth(
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

      if (historyResponse.status === 401) {
        setError("You don't have access to this private repository");
        return;
      }

      if (!historyResponse.ok) {
        throw new Error('Error getting commit history');
      }

      const historyData = await historyResponse.json();
      const commitHistory = historyData.commits || [];
      const processedCommits = processCommits(commitHistory);
      setCommits(processedCommits);

      // Fetch files
      await fetchRepositoryFiles(repoName);
    } catch (error) {
      console.error('Show repo error:', error);
      setError(error.message);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleCommitSelect = (commit) => {
    setExpandedCommits(prev => ({
      ...prev,
      [commit.id]: !prev[commit.id] // Toggle the expanded state
    }));

    // Only set as selected commit if expanding (first click)
    if (!expandedCommits[commit.id]) {
      setSelectedCommit(commit);
    } else {
      setSelectedCommit(null); // Collapse on second click
    }
  };

  const toggleRepoExpand = (repoName) => {
    setExpandedRepos(prev => {
      const isExpanding = !prev[repoName];
      return {
        ...prev,
        [repoName]: isExpanding
      };
    });

    // Show the repository when expanding
    if (!expandedRepos[repoName]) {
      handleShowRepo(repoName);
    } else {
      // Collapse the repository view
      setSelectedRepo(null);
      setCommits([]);
      setSelectedCommit(null);
      setFiles([]);
      setCurrentPath('');
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
      // Transform the array of strings into objects with the expected properties
      const formattedRepos = data.repositories.map(repoName => ({
        name: repoName,
        description: '', // Default empty description
        updatedAt: new Date().toISOString() // Use current date as fallback
      }));
      setRepos(formattedRepos);
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

      // Store tokens and user info - MATCHING THE BACKEND RESPONSE STRUCTURE
      localStorage.setItem('accessToken', data.token); // lowercase 'token'
      localStorage.setItem('refreshToken', data.refreshToken); // lowercase 'refreshToken'
      localStorage.setItem('userId', data.user.id); // lowercase 'user.id'
      localStorage.setItem('userName', data.user.userName); // lowercase 'user.userName'
      localStorage.setItem('userEmail', data.user.email); // lowercase 'user.email'

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

  const handleLogout = async () => {
    try {
      // Call backend logout endpoint if needed
      await fetch(`${serverPath}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAccessToken()}`
        },
        body: JSON.stringify({
          Email: user?.email
        })
      });

      // Clear local storage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');
      localStorage.removeItem('userName');
      localStorage.removeItem('userEmail');

      // Reset state
      setUser(null);
      setRepos([]);
      setSelectedRepo(null);
      setCommits([]);
      setFiles([]);
      setError('');
    } catch (error) {
      console.error('Logout error:', error);
      setError('Error during logout');
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
          UserName: name,  // Must match backend expectation
          Email: email,
          Password: password,
          RoleName: 'User'  // Default role
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      // Store tokens and user info - NOTE THE UPPERCASE PROPERTIES
      localStorage.setItem('accessToken', data.Token);
      localStorage.setItem('refreshToken', data.RefreshToken);
      localStorage.setItem('userId', data.User.id);
      localStorage.setItem('userName', data.User.UserName);
      localStorage.setItem('userEmail', data.User.Email);

      // Set user state
      setUser({
        id: data.User.Id,
        name: data.User.UserName,
        email: data.User.Email
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

  const handleSearch = async (e) => {
    e.preventDefault();

    if (searchQuery.length < 3) {
      setError('Search query must be at least 3 characters');
      return;
    }

    setIsSearching(true);
    setError('');

    try {
      const response = await fetchWithAuth(
        `${serverPath}/api/auth/search?query=${encodeURIComponent(searchQuery)}`
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      setSearchResults(data);
      setActiveTab('search');
    } catch (error) {
      console.error('Search error:', error);
      setError(error.message);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchPublicRepositories = async (userInfo) => {
    setIsLoadingRepos(true);
    try {
      const response = await fetchWithAuth(
        `${serverPath}/api/git/repositories`,
        {
          method: 'POST',
          body: JSON.stringify({
            Id: '',
            Name: '',
            Email: userInfo.email
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Error getting public repositories');
      }

      const data = await response.json();
      const formattedRepos = data.repositories.map(repoName => ({
        name: repoName,
        description: '',
        updatedAt: new Date().toISOString()
      }));
      setViewedUserRepos(formattedRepos);
      setViewedUser(userInfo);
      setViewedUserEmail(userInfo.email);
    } catch (error) {
      console.error('Error fetching public repositories:', error);
      setError(error.message);
    } finally {
      setIsLoadingRepos(false);
    }
  };


  const processCommits = (commitHistory) => {
    return commitHistory.map((commit) => {
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
  };

  const navigateUpDirectory = () => {
    if (!selectedRepo || !currentPath) return;

    const pathParts = currentPath.split('/');
    pathParts.pop();
    const newPath = pathParts.join('/');

    fetchRepositoryFiles(selectedRepo, newPath);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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

        {/* Added Search Bar in the middle */}
        <div className="navbar-center">
          <form className="search-container" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Search users..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button
              className="search-button"
              type="submit"
              disabled={isSearching}
            >
              {isSearching ? (
                <span className="spinner"></span>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
              )}
            </button>
          </form>
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
              <div className="tabs">
                <button
                  className={`tab-button ${activeTab === 'repositories' ? 'active' : ''}`}
                  onClick={() => setActiveTab('repositories')}
                >
                  Your Repositories
                </button>
                <button
                  className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
                  onClick={() => setActiveTab('search')}
                  disabled={searchResults.length === 0}
                >
                  Search Results
                </button>
              </div>

              <div className="repo-actions">
                {activeTab === 'repositories' && (
                  <>
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
                  </>
                )}
              </div>
            </div>

            {/* Conditional rendering */}
            {activeTab === 'search' ? (
              <div className="search-results-container">
                <h3>
                  {viewedUserEmail
                    ? `Public Repositories for ${searchResults.find(u => u.email === viewedUserEmail)?.userName || 'User'}`
                    : `Search Results for "${searchQuery}"`}
                </h3>

                {viewedUserEmail ? (
                  isLoadingRepos ? (
                    <div className="loading">Loading repositories...</div>
                  ) : viewedUserRepos.length > 0 ? (
                    <ul className="repository-list">
                      {viewedUserRepos.map((repo, index) => (
                        <li key={index} className="repository-item">
                          <div
                            className="repo-clickable-area"
                            onClick={() => toggleRepoExpand(repo.name)}
                          >
                            <div className="repo-header">
                              <span className="repo-name">{repo.name}</span>
                              <span className="repo-toggle-icon">
                                {expandedRepos[repo.name] ? '▼' : '▶'}
                              </span>
                            </div>
                            {expandedRepos[repo.name] && (
                              <div className="repo-details">
                                <div className="repo-description">{repo.description || 'No description'}</div>
                                <div className="repo-meta">
                                  <span>Last updated: {new Date(repo.updatedAt).toLocaleString()}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="no-repositories">No public repositories found</div>
                  )
                ) : (
                  <>
                    {isSearching ? (
                      <div className="loading">Searching users...</div>
                    ) : searchResults.length > 0 ? (
                      <ul className="user-list">
                        {searchResults.map((user, index) => (
                          <li key={index} className="user-item">
                            <div className="user-info">
                              <span className="user-name">{user.userName}</span>
                              <span className="user-email">{user.email}</span>
                            </div>
                            <button
                              className="btn btn-view-profile"
                              onClick={async () => {
                                await fetchPublicRepositories({
                                  email: user.email,
                                  userName: user.userName,
                                });
                              }}
                            >
                              View Profile
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="no-results">No users found matching your search</div>
                    )}
                  </>
                )}
              </div>
            ) : isLoadingRepos ? (
              <div className="loading">Loading repositories...</div>
            ) : repos.length > 0 ? (
              <ul className="repository-list">
                {repos.map((repo, index) => (
                  <li key={index} className="repository-item">
                    <div
                      className="repo-clickable-area"
                      onClick={() => toggleRepoExpand(repo.name)}
                    >
                      <div className="repo-header">
                        <span className="repo-name">{repo.name}</span>
                        <span className="repo-toggle-icon">
                          {expandedRepos[repo.name] ? '▼' : '▶'}
                        </span>
                      </div>
                      {expandedRepos[repo.name] && (
                        <div className="repo-details">
                          <div className="repo-description">{repo.description || 'No description'}</div>
                          <div className="repo-meta">
                            <span>Last updated: {new Date(repo.updatedAt).toLocaleString()}</span>
                          </div>
                        </div>
                      )}
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
                            className={`commit-item ${expandedCommits[commit.id] ? 'selected' : ''}`}
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
                    {selectedCommit && expandedCommits[selectedCommit.id] ? (
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
          {selectedRepo && (
            <div className="file-browser-container">
              <h3>Files in {selectedRepo}</h3>
              {currentPath && (
                <div className="file-browser-path">
                  <button
                    className="btn btn-path-up"
                    onClick={() => navigateUpDirectory()}
                  >
                    ↑ Up
                  </button>
                  <span>{currentPath || 'Root'}</span>
                </div>
              )}

              {isLoadingFiles ? (
                <div className="loading">Loading files...</div>
              ) : (
                <div className="file-browser">
                  <div className="file-list">
                    {files.length > 0 ? (
                      <table className="file-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Size</th>
                            <th>Modified</th>
                          </tr>
                        </thead>
                        <tbody>
                          {files.map((file, index) => (
                            <tr
                              key={index}
                              className={`file-item ${file.type === 'directory' ? 'directory' : 'file'}`}
                              onClick={() => {
                                if (file.type === 'directory') {
                                  fetchRepositoryFiles(selectedRepo, file.path);
                                } else {
                                  fetchFileContent(selectedRepo, file.path);
                                }
                              }}
                            >
                              <td>
                                <span className="file-icon">
                                  {file.type === 'directory' ? (
                                    '📁'
                                  ) : file.name.endsWith('.flp') ? (
                                    <img src={flpIcon} alt="FLP File" className="file-type-icon" />
                                  ) : (
                                    '📄'
                                  )}
                                </span>
                                {file.name}
                              </td>
                              <td>{file.type}</td>
                              <td>{file.type === 'file' ? formatFileSize(file.size) : '-'}</td>
                              <td>{new Date(file.lastModified).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div>No files found</div>
                    )}
                  </div>

                  <div className="file-content">
                    {isLoadingFileContent ? (
                      <div className="loading">Loading file content...</div>
                    ) : fileContent ? (
                      <pre>{fileContent}</pre>
                    ) : (
                      <div>Select a file to view its content</div>
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
      {viewedUserEmail ? (
        <h3>
          Public Repositories for {searchResults.find(u => u.email === viewedUserEmail)?.userName || 'User'}
        </h3>
      ) : (
        <h3>Search Results for "{searchQuery}"</h3>
      )}
    </div>
  );
}

export default App;