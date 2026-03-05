using FruityGitServer.DTOs;

namespace FruityGitServer.Services;

/// <summary>
/// Service for managing repository metadata only.
/// All git operations are handled by Gitea.
/// </summary>
public interface IGitService
{
    /// <summary>
    /// Creates repository metadata record. The actual git repository should be created in Gitea.
    /// </summary>
    Task<RepositoryResponseDto> CreateRepositoryMetadataAsync(string repoName, RepositoryInitRequest request);
    
    /// <summary>
    /// Gets list of repositories for a user (metadata only).
    /// </summary>
    Task<RepositoriesListResponseDto> GetRepositoriesAsync(UserInfoDto userInfo);
    
    /// <summary>
    /// Deletes repository metadata record.
    /// Note: The actual repository in Gitea should be deleted separately.
    /// </summary>
    Task DeleteRepositoryAsync(string repoName, UserInfoDto userInfo);
    
    /// <summary>
    /// Gets Gitea repository URL for a given repository name.
    /// </summary>
    Task<string> GetGiteaRepositoryUrlAsync(string repoName, UserInfoDto userInfo);
}

