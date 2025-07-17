import React, { useState } from 'react';
import './App.css';

function App() {
  const serverPath = "http://192.168.135.52:8081"; // Replace with your actual server path
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

      // Store tokens in localStorage
      localStorage.setItem('accessToken', data.token);
      localStorage.setItem('refreshToken', data.refreshToken);

      // Handle successful login (you might want to redirect or update state)
      console.log('Login successful', {
        id: data.user.id,
        name: data.user.userName || email,
        email: email,
        roles: ['User']
      });

      // Here you would typically redirect or update your app state
      // window.location.href = '/dashboard'; // Example redirect

    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
          <button className="btn btn-login">Sign in</button>
          <button className="btn btn-register">Sign up</button>
        </div>
      </nav>

      {/* Sign In Page */}
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
    </div>
  );
}

export default App;