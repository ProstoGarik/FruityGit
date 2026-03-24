// src/Git/GitService.js
import { GiteaService } from './GiteaService';
import { getGiteaToken } from '../Login/AuthService';


export const GitService = {
  FLP_METADATA_FILE_NAME: '.fruitygit-flp-meta.json',

  parseBaseBpmFromMetadata(rawContent) {
    try {
      if (!rawContent) return null;
      const parsed = JSON.parse(rawContent);
      const value = parsed?.baseBpm;
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      return null;
    } catch {
      return null;
    }
  },

  async buildBaseBpmChanges(repoPath, commitHash, changedFiles) {
    const metaFiles = (changedFiles || []).filter(file =>
      String(file || '').toLowerCase().endsWith(this.FLP_METADATA_FILE_NAME.toLowerCase())
    );

    if (metaFiles.length === 0) return [];

    const changes = [];
    for (const metaFile of metaFiles) {
      let currentBpm = null;
      let previousBpm = null;

      const currentResult = await window.electronAPI.git.showFileAtRevision(repoPath, commitHash, metaFile);
      if (currentResult?.success) {
        currentBpm = this.parseBaseBpmFromMetadata(currentResult.content);
      }

      // Parent may not exist (root commit), so we allow failure.
      const previousResult = await window.electronAPI.git.showFileAtRevision(repoPath, `${commitHash}^`, metaFile);
      if (previousResult?.success) {
        previousBpm = this.parseBaseBpmFromMetadata(previousResult.content);
      }

      if (currentBpm === null && previousBpm === null) continue;
      if (currentBpm === previousBpm) continue;

      const oldLabel = previousBpm === null ? '(none)' : String(previousBpm);
      const newLabel = currentBpm === null ? '(none)' : String(currentBpm);
      changes.push(`${metaFile}: ${oldLabel} -> ${newLabel}`);
    }

    return changes;
  },

  getGitHttpAuth(user = null) {
    const giteaToken = getGiteaToken();
    if (!giteaToken) {
      throw new Error('Gitea token not found. Please log in again.');
    }

    let username = user?.name;
    if (!username) {
      try {
        const storedUserRaw = localStorage.getItem('user');
        const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
        username = storedUser?.name || storedUser?.login || storedUser?.email?.split('@')?.[0];
      } catch (error) {
        console.warn('Failed to parse stored user for Git auth:', error);
      }
    }

    return {
      username: username || 'oauth2',
      password: giteaToken,
      token: giteaToken
    };
  },

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
    const gitAuth = this.getGitHttpAuth(user);
    const cloneUrl = GiteaService.buildAuthenticatedUrl(remoteUrl, gitAuth.username, gitAuth.password);
    // Debug: print safe clone URL shape (no token/password)
    const safeCloneUrl = cloneUrl
      ? cloneUrl.replace(new RegExp(`${encodeURIComponent(gitAuth.password)}@`), '***@')
      : null;
    console.log('Cloning repo:', { remoteUrl, localPath, cloneUrl: safeCloneUrl });
    const result = await window.electronAPI.git.clone(cloneUrl, localPath, gitAuth);
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
    const gitAuth = this.getGitHttpAuth();
    const result = await window.electronAPI.git.push(repoPath, 'origin', branch, gitAuth);
    if (!result.success) throw new Error(result.error);
    return result;
  },

  async pullFromServer(repoPath, branch = 'main') {
    const gitAuth = this.getGitHttpAuth();
    const result = await window.electronAPI.git.pull(repoPath, 'origin', branch, gitAuth);
    if (!result.success) throw new Error(result.error);
    return result;
  },

  // Get local commit history
  async getLocalHistory(repoPath, maxCount = 20) {
    const result = await window.electronAPI.git.log(repoPath, maxCount);
    if (!result.success) throw new Error(result.error);

    // Transform to match your app's commit format
    const baseCommits = result.commits.map(commit => ({
      id: commit.hash,
      author: commit.author_name,
      email: commit.author_email,
      message: commit.message,
      date: commit.date,
      summary: commit.message.includes('_summEnd_')
        ? commit.message.split('_summEnd_')[0].trim()
        : commit.message.trim()
    }));

    // Attach file change info for each commit:
    // addedFiles/deletedFiles/modifiedFiles from `git show --name-status`.
    const commitsWithChanges = [];
    for (const commit of baseCommits) {
      try {
        const changesResult = await window.electronAPI.git.showNameStatus(repoPath, commit.id);
        if (changesResult?.success) {
          const allChangedFiles = [
            ...(changesResult.addedFiles || []),
            ...(changesResult.deletedFiles || []),
            ...(changesResult.modifiedFiles || [])
          ];
          const baseBpmChanges = await this.buildBaseBpmChanges(repoPath, commit.id, allChangedFiles);

          commitsWithChanges.push({
            ...commit,
            addedFiles: changesResult.addedFiles || [],
            deletedFiles: changesResult.deletedFiles || [],
            modifiedFiles: changesResult.modifiedFiles || [],
            baseBpmChanges
          });
        } else {
          commitsWithChanges.push({
            ...commit,
            addedFiles: [],
            deletedFiles: [],
            modifiedFiles: [],
            baseBpmChanges: []
          });
        }
      } catch (e) {
        commitsWithChanges.push({
          ...commit,
          addedFiles: [],
          deletedFiles: [],
          modifiedFiles: [],
          baseBpmChanges: []
        });
      }
    }

    return commitsWithChanges;
  },

  // Sync: pull then push (with error handling)
  async syncRepo(repoPath, branch = 'main') {  // убран user
    await this.pullFromServer(repoPath, branch);
    const statusResult = await window.electronAPI.git.status(repoPath);
    if (!statusResult.success) {
      throw new Error(statusResult.error);
    }
    const status = statusResult.status;
    if (status.files?.length > 0 || !status.isClean) {
      return await this.pushToServer(repoPath, branch);
    }
    return { upToDate: true };
  }
};