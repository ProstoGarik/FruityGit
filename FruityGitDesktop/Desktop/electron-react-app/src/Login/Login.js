import React, { useState } from 'react';
import './Login.css';

const LoginWindow = ({ onClose, serverPath }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        if (!email || !password) {
            setError('Требуются email и пароль');
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch(`${serverPath}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ Email: email, Password: password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Ошибка входа');
            }

            localStorage.setItem('accessToken', data.token);      // было data.Token
            localStorage.setItem('refreshToken', data.refreshToken); // было data.RefreshToken
            if (data.giteaToken) {
                localStorage.setItem('giteaToken', data.giteaToken);
            } else {
                localStorage.removeItem('giteaToken');
            }

            onClose({
                id: data.user.id,         // было data.user.id (если там тоже camelCase)
                name: data.user.userName, // было data.user.userName
                email: email,
                roles: ['User']
            });
        } catch (err) {
            console.error('Login error:', err);
            setError(err.message || 'Ошибка входа. Попробуйте снова.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');

        if (!name || !email || !password) {
            setError('Требуются имя, email и пароль');
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch(`${serverPath}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    UserName: name,
                    Email: email,
                    Password: password,
                    RoleName: 'User'
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Ошибка регистрации');
            }

            localStorage.setItem('accessToken', data.token);      // было data.Token
            localStorage.setItem('refreshToken', data.refreshToken); // было data.RefreshToken
            if (data.giteaToken) {
                localStorage.setItem('giteaToken', data.giteaToken);
            } else {
                localStorage.removeItem('giteaToken');
            }

            onClose({
                id: data.user.id,         // было data.user.id (если там тоже camelCase)
                name: data.user.userName, // было data.user.userName
                email: email,
                roles: ['User']
            });
        } catch (err) {
            console.error('Registration error:', err);
            setError(err.message || 'Ошибка регистрации. Попробуйте снова.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-modal-overlay">
            <div className="login-window">
                <div className="login-header">
                    <h2>{isRegistering ? 'Регистрация' : 'Вход'} в FruityGit</h2>
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
                                <label>Имя пользователя:</label>
                                <input
                                    type="text"
                                    className="login-input"
                                    placeholder="Введите имя пользователя"
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
                                placeholder="Введите email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="input-group">
                            <label>Пароль:</label>
                            <input
                                type="password"
                                className="login-input"
                                placeholder="Введите пароль"
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
                                    ? (isRegistering ? 'Регистрация...' : 'Вход...')
                                    : (isRegistering ? 'Зарегистрироваться' : 'Войти')}
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
                                    ? 'Уже есть аккаунт? Войти'
                                    : 'Нет аккаунта? Зарегистрироваться'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginWindow;