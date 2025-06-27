// src/components/LoginWindow.js
import React, { useState } from 'react';
import './Login.css';

const LoginWindow = ({ onClose }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const serverPath = 'http://192.168.135.52:8000'; // Use the same server path as in App.js

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
                    email,
                    password
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            if (data.success) {
                // Pass complete user data back to App component
                onClose({
                    id: data.user.id,
                    name: data.user.name,
                    email: data.user.email
                });
            } else {
                throw new Error(data.message || 'Login failed');
            }
        } catch (err) {
            console.error('Login error:', err);
            setError(err.message || 'Login failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-modal-overlay">
            <div className="login-window">
                <div className="login-header">
                    <h2>Вход в FruityGit</h2>
                    <button 
                        className="close-button" 
                        onClick={() => onClose(null)}
                    >
                        ×
                    </button>
                </div>

                <div className="login-content">
                    <form onSubmit={handleLogin}>
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
                                {isLoading ? 'Logging in...' : 'Login'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginWindow;