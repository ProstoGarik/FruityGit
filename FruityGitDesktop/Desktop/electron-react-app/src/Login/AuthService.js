// AuthService.js

// === Функции для JWT-аутентификации (старые) ===
export const getAccessToken = () => localStorage.getItem('accessToken');
export const getRefreshToken = () => localStorage.getItem('refreshToken');

export const setTokens = (accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
};

export const clearTokens = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('giteaToken');
};

export const isAuthenticated = () => {
    return !!getAccessToken();
};

export const refreshAuthToken = async (serverPath) => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    try {
        const response = await fetch(`${serverPath}/api/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                Token: refreshToken
            }),
        });

        if (!response.ok) {
            throw new Error('Token refresh failed');
        }

        const data = await response.json();
        setTokens(data.token, data.refreshToken);
        return data.token;
    } catch (error) {
        console.error('Token refresh error:', error);
        clearTokens();
        return null;
    }
};

// === Функции для Gitea (новые) ===
export const getGiteaToken = () => {
  const token = localStorage.getItem('giteaToken');
  if (!token || token === 'null' || token === 'undefined') {
    return null;
  }
  return token;
};

export const fetchWithGitea = async (url, options = {}) => {
  const token = getGiteaToken();
  if (!token) {
    throw new Error('Gitea token not found. Please login again.');
  }
  const isProxyCall = typeof url === 'string' && url.includes('/gitea/');
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `token ${token}`,
    ...(isProxyCall ? { 'X-Gitea-Token': token } : {}),
    ...options.headers
  };
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gitea API error (${response.status}): ${errorText}`);
  }
  return response;
};