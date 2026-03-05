// src/Git/GiteaService.js
// Service for interacting with Gitea API

const DEFAULT_GITEA_URL = 'http://localhost:3000';

export const GiteaService = {
  /**
   * Get Gitea API base URL
   */
  getGiteaUrl() {
    return DEFAULT_GITEA_URL;
  },

  /**
   * Get Gitea API base path
   */
  getApiBase() {
    return `${this.getGiteaUrl()}/api/v1`;
  },

  /**
   * Authenticate with Gitea and get/create access token
   * @param {string} username - Gitea username
   * @param {string} password - Gitea password
   * @returns {Promise<{token: string, user: object}>}
   */
  async authenticate(username, password) {
    try {
      // First, try to get user info to verify credentials using Basic auth
      const authString = btoa(`${username}:${password}`);
      const response = await fetch(`${this.getApiBase()}/user`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Gitea authentication failed. Please check your credentials.');
      }

      const user = await response.json();

      // Try to get existing tokens
      const tokensResponse = await fetch(`${this.getApiBase()}/users/${username}/tokens`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/json'
        }
      });

      let token = null;
      if (tokensResponse.ok) {
        const tokens = await tokensResponse.json();
        // Use existing token if available (look for fruitygit token)
        if (tokens && Array.isArray(tokens)) {
          const existingToken = tokens.find(t => t.name && t.name.startsWith('fruitygit'));
          if (existingToken) {
            // Note: Gitea doesn't return the token value after creation, only sha1
            // We need to create a new one or use password
            token = existingToken.sha1;
          }
        }
      }

      // If no suitable token exists, create one
      if (!token) {
        const tokenName = `fruitygit-${Date.now()}`;
        const createTokenResponse = await fetch(`${this.getApiBase()}/users/${username}/tokens`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: tokenName,
            scopes: ['read:repository', 'write:repository', 'read:user', 'write:user']
          })
        });

        if (createTokenResponse.ok) {
          const tokenData = await createTokenResponse.json();
          // Gitea returns the token in the response
          token = tokenData.sha1 || tokenData.token;
        }
      }

      return {
        token: token || password, // Fallback to password if token creation fails
        user: user,
        authString: authString
      };
    } catch (error) {
      console.error('Gitea authentication error:', error);
      throw error;
    }
  },

  /**
   * Create a repository in Gitea
   * @param {string} repoName - Repository name
   * @param {boolean} isPrivate - Whether repository is private
   * @param {string} username - Gitea username
   * @param {string} authToken - Gitea auth token or password
   * @returns {Promise<{url: string, cloneUrl: string}>}
   */
  async createRepository(repoName, isPrivate, username, authToken) {
    try {
      // Try token auth first
      let response = await fetch(`${this.getApiBase()}/user/repos`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: repoName,
          private: isPrivate,
          auto_init: true, // Initialize with README
          default_branch: 'main'
        })
      });

      // If token auth fails, try Basic auth
      if (!response.ok && response.status === 401) {
        const authString = btoa(`${username}:${authToken}`);
        response = await fetch(`${this.getApiBase()}/user/repos`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${authString}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: repoName,
            private: isPrivate,
            auto_init: true,
            default_branch: 'main'
          })
        });
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Failed to create repository in Gitea' }));
        throw new Error(error.message || `Failed to create repository: ${response.status} ${response.statusText}`);
      }

      const repo = await response.json();
      return {
        url: repo.html_url,
        cloneUrl: repo.clone_url,
        sshUrl: repo.ssh_url,
        id: repo.id
      };
    } catch (error) {
      console.error('Gitea create repository error:', error);
      throw error;
    }
  },

  /**
   * Get user's repositories from Gitea
   * @param {string} username - Gitea username
   * @param {string} authToken - Gitea auth token
   * @returns {Promise<Array>}
   */
  async getUserRepositories(username, authToken) {
    try {
      const response = await fetch(`${this.getApiBase()}/user/repos?type=all`, {
        method: 'GET',
        headers: {
          'Authorization': `token ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get repositories from Gitea');
      }

      const repos = await response.json();
      return repos.map(repo => ({
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        cloneUrl: repo.clone_url,
        sshUrl: repo.ssh_url,
        htmlUrl: repo.html_url,
        owner: repo.owner.login
      }));
    } catch (error) {
      console.error('Gitea get repositories error:', error);
      throw error;
    }
  },

  /**
   * Delete a repository in Gitea
   * @param {string} owner - Repository owner (username)
   * @param {string} repoName - Repository name
   * @param {string} authToken - Gitea auth token
   */
  async deleteRepository(owner, repoName, authToken) {
    try {
      const response = await fetch(`${this.getApiBase()}/repos/${owner}/${repoName}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `token ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok && response.status !== 404) {
        throw new Error('Failed to delete repository in Gitea');
      }

      return true;
    } catch (error) {
      console.error('Gitea delete repository error:', error);
      throw error;
    }
  },

  /**
   * Get repository information
   * @param {string} owner - Repository owner
   * @param {string} repoName - Repository name
   * @param {string} authToken - Gitea auth token (optional for public repos)
   * @returns {Promise<object>}
   */
  async getRepository(owner, repoName, authToken = null) {
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (authToken) {
        headers['Authorization'] = `token ${authToken}`;
      }

      const response = await fetch(`${this.getApiBase()}/repos/${owner}/${repoName}`, {
        method: 'GET',
        headers: headers
      });

      if (!response.ok) {
        throw new Error('Failed to get repository from Gitea');
      }

      const repo = await response.json();
      return {
        name: repo.name,
        fullName: repo.full_name,
        private: repo.private,
        cloneUrl: repo.clone_url,
        sshUrl: repo.ssh_url,
        htmlUrl: repo.html_url,
        owner: repo.owner.login
      };
    } catch (error) {
      console.error('Gitea get repository error:', error);
      throw error;
    }
  },

  /**
   * Build clone URL with authentication
   * @param {string} cloneUrl - Base clone URL
   * @param {string} username - Username
   * @param {string} password - Password or token
   * @returns {string}
   */
  buildAuthenticatedUrl(cloneUrl, username, password) {
    if (!cloneUrl) return null;
    
    // Handle both http and https
    const protocol = cloneUrl.startsWith('https://') ? 'https://' : 'http://';
    const urlWithoutProtocol = cloneUrl.replace(/^https?:\/\//, '').replace(/^[^@]+@/, '');
    
    return `${protocol}${encodeURIComponent(username)}:${encodeURIComponent(password)}@${urlWithoutProtocol}`;
  }
};

