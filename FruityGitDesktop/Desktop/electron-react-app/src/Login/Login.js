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
            localStorage.setItem('accessToken', data.token); // Note lowercase 'token'
            localStorage.setItem('refreshToken', data.refreshToken); // Note lowercase 'refreshToken'

            onClose({
                id: data.user.id, // Changed from data.User.Id to data.user.id
                name: data.user.userName || email, // Changed from data.User.UserName
                email: email,
                roles: ['User'] // Assuming default role since it's not in the response
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
                    UserName: name,  // Add username to the request
                    Email: email,
                    Password: password,
                    RoleName: 'User'
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Registration failed');
            }

            // Store tokens in localStorage
            localStorage.setItem('accessToken', data.token);
            localStorage.setItem('refreshToken', data.refreshToken);

            onClose({
                id: data.user.id,
                name: name, // Use the username from state
                email: email,
                roles: ['User']
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
                                <label>Username:</label>
                                <input
                                    type="text"
                                    className="login-input"
                                    placeholder="Enter your username"
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