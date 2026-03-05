// src/Git/GitService.js
import { GiteaService } from './GiteaService';

export const GitService = {
  // Check prerequisites
  async checkGitInstalled() {
    const result = await window.electronAPI.git.checkInstalled();
    if (!result.installed) {
      throw new Error(result.message || 'Git not found');
    }
    return true;
  },

  // Initialize or open local repo
  async initLocalRepo(localPath) {
    const result = await window.electronAPI.git.initOrOpen(localPath);
    if (!result.success) throw new Error(result.error);
    return result;
  },

  // Clone from Gitea
  async cloneRepo(remoteUrl, localPath, user) {
    // Get Gitea credentials - try stored token first, then fallback to username
    const giteaToken = localStorage.getItem('giteaToken');
    const giteaUsername = user?.name || user?.email || 'user';
    const giteaPassword = giteaToken || user?.accessToken || '';
    
    // Build authenticated URL if credentials are available
    let cloneUrl = remoteUrl;
    if (giteaUsername && giteaPassword) {
      cloneUrl = GiteaService.buildAuthenticatedUrl(remoteUrl, giteaUsername, giteaPassword);
    }
    
    const auth = (giteaUsername && giteaPassword) ? {
      username: giteaUsername,
      password: giteaPassword
    } : null;
    
    const result = await window.electronAPI.git.clone(cloneUrl || remoteUrl, localPath, auth);
    if (!result.success) throw new Error(result.error);
    return result;
  },

  // Commit a file with metadata
  async commitFile(repoPath, filePath, summary, description, user) {
    // Add the specific file
    await window.electronAPI.git.add(repoPath, filePath);
    
    // Format commit message with your _summEnd_ convention
    const message = `${summary.trim()}_summEnd_${description?.trim() || ''}`;
    
    const author = user ? { name: user.name, email: user.email } : null;
    const result = await window.electronAPI.git.commit(repoPath, message, author);
    
    if (!result.success) throw new Error(result.error);
    return result.commit;
  },

  // Push local changes to Gitea
  async pushToServer(repoPath, user, branch = 'main') {
    // Get Gitea credentials
    const giteaToken = localStorage.getItem('giteaToken');
    const giteaUsername = user?.name || user?.email || 'user';
    const giteaPassword = giteaToken || user?.accessToken || '';
    
    const auth = (giteaUsername && giteaPassword) ? {
      username: giteaUsername,
      password: giteaPassword
    } : null;
    
    const result = await window.electronAPI.git.push(repoPath, 'origin', branch, auth);
    if (!result.success) throw new Error(result.error);
    return result.result;
  },

  // Get local commit history
  async getLocalHistory(repoPath, maxCount = 20) {
    const result = await window.electronAPI.git.log(repoPath, maxCount);
    if (!result.success) throw new Error(result.error);
    
    // Transform to match your app's commit format
    return result.commits.map(commit => ({
      id: commit.hash,
      author: commit.author_name,
      email: commit.author_email,
      message: commit.message,
      date: commit.date,
      summary: commit.message.includes('_summEnd_') 
        ? commit.message.split('_summEnd_')[0].trim()
        : commit.message.trim()
    }));
  },

  // Sync: pull then push (with error handling)
  async syncRepo(repoPath, user, branch = 'main') {
    // First pull latest from server
    await window.electronAPI.git.pull(repoPath, 'origin', branch);
    
    // Then push local changes if any
    const status = await window.electronAPI.git.status(repoPath);
    if (status.files?.length > 0 || !status.isClean()) {
      return await this.pushToServer(repoPath, user, branch);
    }
    return { upToDate: true };
  }
};