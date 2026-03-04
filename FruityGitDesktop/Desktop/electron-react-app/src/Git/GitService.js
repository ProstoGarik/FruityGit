// src/Git/GitService.js

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

  // Clone from your ASP.NET server or other remote
  async cloneRepo(remoteUrl, localPath, user) {
    // For your server, you might need auth token
    const auth = user?.accessToken ? {
      username: 'token', // or your auth scheme
      password: user.accessToken
    } : null;
    
    const result = await window.electronAPI.git.clone(remoteUrl, localPath, auth);
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

  // Push local changes to your server
  async pushToServer(repoPath, user, branch = 'main') {
    const auth = user?.accessToken ? {
      username: 'token',
      password: user.accessToken
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