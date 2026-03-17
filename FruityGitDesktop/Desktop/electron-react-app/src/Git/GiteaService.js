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
    const safeUsername = encodeURIComponent(username || 'oauth2');
    const safePassword = encodeURIComponent(password || '');
    return `${protocol}${safeUsername}:${safePassword}@${urlWithoutProtocol}`;
  }
};