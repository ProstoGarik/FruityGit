using FruityGitServer.DTOs;
using FruityGitServer.Exceptions;
using FruityGitServer.Models;
using FruityGitServer.Repositories;
using Repository = FruityGitServer.Models.Repository;

namespace FruityGitServer.Services;

/// <summary>
/// Service for managing repository metadata only.
/// All git operations are handled by Gitea.
/// </summary>
public class GitService : IGitService
{
    private readonly IRepositoryRepository _repositoryRepository;
    private readonly ILogger<GitService> _logger;
    private readonly string _giteaUrl;

    public GitService(
        IRepositoryRepository repositoryRepository,
        IConfiguration configuration,
        ILogger<GitService> logger)
    {
        _repositoryRepository = repositoryRepository;
        _logger = logger;
        _giteaUrl = configuration["GITEA_PUBLIC_URL"] ?? Environment.GetEnvironmentVariable("GITEA_PUBLIC_URL") ?? "http://localhost:3000/gitea";
    }

    public async Task<RepositoryResponseDto> CreateRepositoryMetadataAsync(string repoName, RepositoryInitRequest request)
    {
        ValidateRepositoryName(repoName);
        ValidateUserInfo(request.UserId, request.UserName, request.UserEmail);

        _logger.LogInformation("Creating repository metadata: {RepoName} for user: {UserId}", repoName, request.UserId);

        // Check if user already has a repository with this name
        if (await _repositoryRepository.ExistsAsync(repoName, request.UserId))
        {
            throw new RepositoryAlreadyExistsException(repoName);
        }

        // Create metadata record only
        // Note: The actual git repository should be created in Gitea by the client
        var repository = new Repository
        {
            Name = repoName,
            DirectoryPath = string.Empty, // No longer storing physical paths
            AuthorId = request.UserId,
            AuthorName = request.UserName,
            AuthorEmail = request.UserEmail,
            IsPrivate = request.IsPrivate,
            CreatedAt = DateTime.UtcNow
        };

        await _repositoryRepository.CreateAsync(repository);

        // Construct Gitea repository URL
        var giteaRepoUrl = $"{_giteaUrl}/{request.UserName}/{repoName}.git";

        return new RepositoryResponseDto
        {
            Success = true,
            RepositoryName = repoName,
            IsPrivate = request.IsPrivate,
            Path = giteaRepoUrl // Return Gitea URL instead of local path
        };
    }


    public async Task<RepositoriesListResponseDto> GetRepositoriesAsync(UserInfoDto userInfo)
    {
        if (userInfo == null || (string.IsNullOrEmpty(userInfo.Id) && string.IsNullOrEmpty(userInfo.Email)))
        {
            throw new ArgumentException("Either User Id or Email must be provided", nameof(userInfo));
        }

        var allRepos = new List<Repository>();

        if (!string.IsNullOrEmpty(userInfo.Id))
        {
            _logger.LogInformation("Fetching all repositories for user {UserId} (including private)", userInfo.Id);
            var userRepos = await _repositoryRepository.GetUserRepositoriesAsync(userInfo.Id);
            allRepos.AddRange(userRepos);

            _logger.LogInformation("Fetching all public repositories");
            var publicRepos = await _repositoryRepository.GetAllPublicRepositoriesAsync();
            allRepos.AddRange(publicRepos);
        }
        else
        {
            _logger.LogInformation("Fetching public repositories for email {Email}", userInfo.Email);
            var publicReposByEmail = await _repositoryRepository.GetPublicRepositoriesByEmailAsync(userInfo.Email!);
            allRepos.AddRange(publicReposByEmail);
        }

        var distinctRepos = allRepos
            .GroupBy(r => r.Id)
            .Select(g => g.First())
            .ToList();

        // Return repository names from metadata only
        var repoNames = distinctRepos.Select(r => r.Name).ToList();

        return new RepositoriesListResponseDto
        {
            Count = repoNames.Count,
            Repositories = repoNames
        };
    }

    public async Task<string> GetGiteaRepositoryUrlAsync(string repoName, UserInfoDto userInfo)
    {
        ValidateRepositoryName(repoName);
        ValidateUserInfo(userInfo.Id, userInfo.Name, userInfo.Email);

        await EnsureRepositoryAccessAsync(repoName, userInfo.Id);

        // Get repository metadata to find the owner
        var repository = await _repositoryRepository.GetByNameAsync(repoName, userInfo.Id);
        if (repository == null)
        {
            throw new RepositoryNotFoundException(repoName);
        }

        // Construct Gitea repository URL
        // Format: http://gitea:3000/{username}/{reponame}.git
        var giteaRepoUrl = $"{_giteaUrl}/{repository.AuthorName}/{repoName}.git";
        
        return giteaRepoUrl;
    }

    public async Task DeleteRepositoryAsync(string repoName, UserInfoDto userInfo)
    {
        ValidateRepositoryName(repoName);
        ValidateUserInfo(userInfo.Id, userInfo.Name, userInfo.Email);

        var repository = await _repositoryRepository.GetByNameAsync(repoName, userInfo.Id);

        if (repository == null)
        {
            throw new Exceptions.RepositoryNotFoundException(repoName);
        }

        // Delete metadata only
        // Note: The actual repository in Gitea should be deleted separately via Gitea API
        await _repositoryRepository.DeleteAsync(repository.Id);

        _logger.LogInformation("Successfully deleted repository metadata: {RepoName}", repoName);
    }

    private async Task EnsureRepositoryAccessAsync(string repoName, string userId)
    {
        var repository = await _repositoryRepository.GetByNameAsync(repoName);

        if (repository == null)
        {
            throw new Exceptions.RepositoryNotFoundException(repoName);
        }

        if (repository.IsPrivate && repository.AuthorId != userId)
        {
            throw new UnauthorizedRepositoryAccessException(repoName);
        }
    }

    private static void ValidateRepositoryName(string repoName)
    {
        if (string.IsNullOrWhiteSpace(repoName))
        {
            throw new InvalidRepositoryNameException(repoName);
        }

        if (repoName.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0)
        {
            throw new InvalidRepositoryNameException(repoName);
        }
    }

    private static void ValidateUserInfo(string userId, string userName, string userEmail)
    {
        if (string.IsNullOrEmpty(userId))
        {
            throw new ArgumentException("User ID is required", nameof(userId));
        }

        if (string.IsNullOrEmpty(userName))
        {
            throw new ArgumentException("User name is required", nameof(userName));
        }

        if (string.IsNullOrEmpty(userEmail))
        {
            throw new ArgumentException("User email is required", nameof(userEmail));
        }
    }

}

