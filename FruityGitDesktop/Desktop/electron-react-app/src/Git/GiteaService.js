// src/Git/GiteaService.js

export const GiteaService = {
  /**
   * Build clone URL with authentication token
   * @param {string} cloneUrl - Base clone URL (e.g., http://localhost:3001/user/repo.git)
   * @param {string} token - Gitea token
   * @returns {string} URL with embedded token
   */
  buildAuthenticatedUrl(cloneUrl, token) {
    if (!cloneUrl) return null;
    const protocol = cloneUrl.startsWith('https://') ? 'https://' : 'http://';
    const urlWithoutProtocol = cloneUrl.replace(/^https?:\/\//, '');
    return `${protocol}${token}@${urlWithoutProtocol}`;
  }
};