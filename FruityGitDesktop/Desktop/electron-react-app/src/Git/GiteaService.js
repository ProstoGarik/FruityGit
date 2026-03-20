// src/Git/GiteaService.js

export const GiteaService = {
  /**
   * Build clone URL with authentication token
   * @param {string} cloneUrl - Base clone URL (e.g., http://localhost:3001/user/repo.git)
   * @param {string} username - Gitea username
   * @param {string} password - Gitea password or personal access token
   * @returns {string} URL with embedded token
   */
  buildAuthenticatedUrl(cloneUrl, username, password) {
    if (!cloneUrl) return null;
    const protocol = cloneUrl.startsWith('https://') ? 'https://' : 'http://';
    const urlWithoutProtocol = cloneUrl.replace(/^https?:\/\//, '');
    // If caller already included credentials (e.g. user:pass@host), strip them
    // to avoid malformed URLs and libcurl parsing issues.
    const urlWithoutAuth = urlWithoutProtocol.replace(/^[^@]+@/, '');
    const safeUsername = encodeURIComponent(username || 'oauth2');
    const safePassword = encodeURIComponent(password || '');
    return `${protocol}${safeUsername}:${safePassword}@${urlWithoutAuth}`;
  }
};