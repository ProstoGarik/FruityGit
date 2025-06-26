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
                // Pass user data back to App component
                onClose({
                    name: data.user?.name || email.split('@')[0],
                    email: data.user?.email || email
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
                // Login successful - close the window or handle the user data
                onClose();
                // You might want to store the user data in your app state here
                console.log('Logged in user:', data.user);
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
                </div>

                <div className="login-content">
                    <form onSubmit={handleLogin}>
                        <div className="input-group">
                            <input
                                type="text"
                                className="login-input"
                                placeholder="Email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="input-group">
                            <input
                                type="password"
                                className="login-input"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        {error && <div className="error-message">{error}</div>}

                        <button
                            className="login-button"
                            type="submit"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Logging in...' : 'Login'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginWindow;