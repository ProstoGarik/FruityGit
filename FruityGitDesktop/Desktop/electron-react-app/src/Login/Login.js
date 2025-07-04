import React, { useState } from 'react';
import './Login.css';

const LoginWindow = ({ onClose, serverPath }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState(''); // For registration
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false); // Toggle between login/register

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
            localStorage.setItem('accessToken', data.Token);
            localStorage.setItem('refreshToken', data.RefreshToken);

            onClose({
                id: data.User.Id,
                name: data.User.UserName || email,
                email: email,
                roles: data.UserRoles // If you need roles
            });
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
                    Email: email,
                    Password: password,
                    RoleName: 'User' // Default role, adjust as needed
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Registration failed');
            }

            // Store tokens in localStorage
            localStorage.setItem('accessToken', data.Token);
            localStorage.setItem('refreshToken', data.RefreshToken);

            onClose({
                id: data.User.Id,
                name: name,
                email: email,
                roles: [data.RoleName] // Assuming single role
            });
        } catch (err) {
            console.error('Registration error:', err);
            setError(err.message || 'Registration failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-modal-overlay">
            <div className="login-window">
                <div className="login-header">
                    <h2>{isRegistering ? 'Register' : 'Login'} to FruityGit</h2>
                    <button
                        className="close-button"
                        onClick={() => onClose(null)}
                    >
                        ×
                    </button>
                </div>

                <div className="login-content">
                    <form onSubmit={isRegistering ? handleRegister : handleLogin}>
                        {isRegistering && (
                            <div className="input-group">
                                <label>Name:</label>
                                <input
                                    type="text"
                                    className="login-input"
                                    placeholder="Enter your name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                />
                            </div>
                        )}

                        <div className="input-group">
                            <label>Email:</label>
                            <input
                                type="email"
                                className="login-input"
                                placeholder="Enter your email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="input-group">
                            <label>Password:</label>
                            <input
                                type="password"
                                className="login-input"
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        {error && <div className="error-message">{error}</div>}

                        <div className="login-actions">
                            <button
                                className="login-button"
                                type="submit"
                                disabled={isLoading}
                            >
                                {isLoading
                                    ? (isRegistering ? 'Registering...' : 'Logging in...')
                                    : (isRegistering ? 'Register' : 'Login')}
                            </button>
                        </div>

                        <div className="toggle-form">
                            <button
                                type="button"
                                className="toggle-button"
                                onClick={() => setIsRegistering(!isRegistering)}
                                disabled={isLoading}
                            >
                                {isRegistering
                                    ? 'Already have an account? Login'
                                    : "Don't have an account? Register"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginWindow;