// src/components/RegisterWindow.js
import React, { useState } from 'react';
import './Login.css'; // Reusing the same styles as LoginWindow

const RegisterWindow = ({ onClose, onSwitchToLogin }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const serverPath = 'http://192.168.135.52:8000'; // Same server path as in App.js

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
                    name,
                    email,
                    password
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Registration failed');
            }

            if (data.success) {
                // Registration successful - pass user data back and close
                onClose({
                    name: data.user?.name || name,
                    email: data.user?.email || email
                });
            } else {
                throw new Error(data.message || 'Registration failed');
            }
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
                    <h2>Регистрация в FruityGit</h2>
                </div>
                
                <div className="login-content">
                    <form onSubmit={handleRegister}>
                        <div className="input-group">
                            <input
                                type="text"
                                className="login-input"
                                placeholder="Name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        
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
                            {isLoading ? 'Registering...' : 'Register'}
                        </button>

                        <div className="switch-auth">
                            Уже есть аккаунт?{' '}
                            <button 
                                type="button"
                                className="switch-button"
                                onClick={onSwitchToLogin}
                            >
                                Войти
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RegisterWindow;