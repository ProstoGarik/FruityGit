import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const serverPath = "http://192.168.135.52:8081";
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [repos, setRepos] = useState([]);
  const [user, setUser] = useState(null);

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
              <button className="btn btn-login">Sign in</button>
              <button className="btn btn-register">Sign up</button>
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
              <button 
                className="btn btn-refresh" 
                onClick={handleRefreshRepo}
                disabled={isLoadingRepos}
              >
                {isLoadingRepos ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
            
            {isLoadingRepos ? (
              <div className="loading">Loading repositories...</div>
            ) : repos.length > 0 ? (
              <ul className="repository-list">
                {repos.map((repo, index) => (
                  <li key={index} className="repository-item">
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
        </div>
      ) : (
        <div className="signin-container">
          <div className="signin-box">
            <h2>Sign in to your account</h2>
            <form className="signin-form" onSubmit={handleLogin}>
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
                  <a href="/forgot" className="forgot-password">Forgot password?</a>
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
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;