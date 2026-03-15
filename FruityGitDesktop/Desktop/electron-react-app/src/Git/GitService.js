// src/Git/GitService.js
import { GiteaService } from './GiteaService';
import { getGiteaToken } from '../Login/AuthService';


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
    const giteaToken = getGiteaToken();
    if (!giteaToken) {
      throw new Error('Gitea token not found. Please log in again.');
    }
    const cloneUrl = GiteaService.buildAuthenticatedUrl(remoteUrl, giteaToken);
    const result = await window.electronAPI.git.clone(cloneUrl, localPath);
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

  // Commit already staged changes
  async commitStagedChanges(repoPath, summary, description, user) {
    const message = `${summary.trim()}_summEnd_${description?.trim() || ''}`;
    const author = user ? { name: user.name, email: user.email } : null;
    const result = await window.electronAPI.git.commit(repoPath, message, author);
    if (!result.success) throw new Error(result.error);
    return result.commit;
  },

  // Push local changes to Gitea
  async pushToServer(repoPath, branch = 'main') {
    const giteaToken = getGiteaToken();
    if (!giteaToken) {
      throw new Error('Gitea token not found. Please log in again.');
    }
    const result = await window.electronAPI.git.push(repoPath, 'origin', branch, { token: giteaToken });
    if (!result.success) throw new Error(result.error);
    return result;
  },

  async pullFromServer(repoPath, branch = 'main') {
    const giteaToken = getGiteaToken();
    if (!giteaToken) {
      throw new Error('Gitea token not found. Please log in again.');
    }

    const result = await window.electronAPI.git.pull(repoPath, 'origin', branch, { token: giteaToken });
    if (!result.success) throw new Error(result.error);
    return result;
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
  async syncRepo(repoPath, branch = 'main') {  // убран user
    await this.pullFromServer(repoPath, branch);
    const statusResult = await window.electronAPI.git.status(repoPath);
    if (!statusResult.success) {
      throw new Error(statusResult.error);
    }
    const status = statusResult.status;
    if (status.files?.length > 0 || !status.isClean()) {
      return await this.pushToServer(repoPath, branch);
    }
    return { upToDate: true };
  }
};