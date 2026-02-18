using FruityGitServer.DTOs;
using FruityGitServer.Exceptions;
using FruityGitServer.Models;
using FruityGitServer.Repositories;
using LibGit2Sharp;
using System.IO.Compression;
using Repository = FruityGitServer.Models.Repository;
using GitRepository = LibGit2Sharp.Repository;

namespace FruityGitServer.Services;

public class GitService : IGitService
{
    private readonly IRepositoryRepository _repositoryRepository;
    private readonly string _reposRootPath;
    private readonly ILogger<GitService> _logger;
    private const int MaxFileSize = 100 * 1024 * 1024; // 100MB

    public GitService(
        IRepositoryRepository repositoryRepository,
        IWebHostEnvironment env,
        ILogger<GitService> logger)
    {
        _repositoryRepository = repositoryRepository;
        _reposRootPath = Path.Combine(env.ContentRootPath, "ReposFolder");
        _logger = logger;
        Directory.CreateDirectory(_reposRootPath);
    }

    public async Task<RepositoryResponseDto> InitializeRepositoryAsync(string repoName, RepositoryInitRequest request)
    {
        ValidateRepositoryName(repoName);
        ValidateUserInfo(request.UserId, request.UserName, request.UserEmail);

        _logger.LogInformation("Initializing repository: {RepoName} for user: {UserId}", repoName, request.UserId);

        // Check if user already has a repository with this name
        if (await _repositoryRepository.ExistsAsync(repoName, request.UserId))
        {
            throw new RepositoryAlreadyExistsException(repoName);
        }

        var repoPath = Path.Combine(_reposRootPath, repoName);

        // Check if the physical directory exists (global check)
        if (Directory.Exists(repoPath) && GitRepository.IsValid(repoPath))
        {
            throw new RepositoryAlreadyExistsException(repoName);
        }

        // Clean up if directory exists but is not a valid git repo
        if (Directory.Exists(repoPath))
        {
            Directory.Delete(repoPath, true);
        }

        Directory.CreateDirectory(repoPath);
        GitRepository.Init(repoPath);

        var repository = new Repository
        {
            Name = repoName,
            DirectoryPath = repoPath,
            AuthorId = request.UserId,
            AuthorName = request.UserName,
            AuthorEmail = request.UserEmail,
            IsPrivate = request.IsPrivate,
            CreatedAt = DateTime.UtcNow
        };

        await _repositoryRepository.CreateAsync(repository);

        return new RepositoryResponseDto
        {
            Success = true,
            RepositoryName = repoName,
            IsPrivate = request.IsPrivate,
            Path = repoPath
        };
    }

    public async Task<CommitResponseDto> CommitAsync(string repoName, CommitRequestDto request)
    {
        ValidateRepositoryName(repoName);
        ValidateUserInfo(request.UserInfo.Id, request.UserInfo.Name, request.UserInfo.Email);

        if (request.File == null || request.File.Length == 0)
        {
            throw new ArgumentException("No file was uploaded", nameof(request));
        }

        if (request.File.Length > MaxFileSize)
        {
            throw new ArgumentException($"File size exceeds maximum limit of {MaxFileSize} bytes", nameof(request));
        }

        var fileName = Path.GetFileName(request.File.FileName);
        if (string.IsNullOrEmpty(fileName))
        {
            throw new ArgumentException("Invalid file name", nameof(request));
        }

        _logger.LogInformation("Committing file {FileName} to repository {RepoName} for user {UserId}",
            fileName, repoName, request.UserInfo.Id);

        await EnsureRepositoryAccessAsync(repoName, request.UserInfo.Id);

        var repoPath = Path.Combine(_reposRootPath, repoName);
        var filePath = Path.Combine(repoPath, fileName);

        using var repo = new GitRepository(repoPath);
        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await request.File.CopyToAsync(stream);
        }

        Commands.Stage(repo, filePath);

        var commitMessage = $"{request.Summary} _summEnd_ {request.Description}";
        var signature = new Signature(request.UserInfo.Name, request.UserInfo.Email, DateTimeOffset.Now);
        repo.Commit(commitMessage, signature, signature);

        return new CommitResponseDto
        {
            Success = true,
            FileName = fileName,
            CommitMessage = commitMessage
        };
    }

    public async Task<RepositoriesListResponseDto> GetRepositoriesAsync(UserInfoDto userInfo)
    {
        if (userInfo == null || (string.IsNullOrEmpty(userInfo.Id) && string.IsNullOrEmpty(userInfo.Email)))
        {
            throw new ArgumentException("Either User Id or Email must be provided", nameof(userInfo));
        }

        IEnumerable<Repository> repositories;

        if (!string.IsNullOrEmpty(userInfo.Id))
        {
            _logger.LogInformation("Searching repositories for UserId: {UserId}", userInfo.Id);
            repositories = await _repositoryRepository.GetUserRepositoriesAsync(userInfo.Id);
        }
        else
        {
            _logger.LogInformation("Searching public repositories for Email: {Email}", userInfo.Email);
            repositories = await _repositoryRepository.GetPublicRepositoriesByEmailAsync(userInfo.Email!);
        }

        var dbRepos = repositories.Select(r => r.Name).ToList();

        if (!Directory.Exists(_reposRootPath))
        {
            return new RepositoriesListResponseDto
            {
                Count = 0,
                Repositories = new List<string>()
            };
        }

        var validRepos = Directory.GetDirectories(_reposRootPath)
            .Where(dir => GitRepository.IsValid(dir))
            .Select(dir => Path.GetRelativePath(_reposRootPath, dir))
            .Where(repoName => dbRepos.Contains(repoName))
            .ToList();

        return new RepositoriesListResponseDto
        {
            Count = validRepos.Count,
            Repositories = validRepos
        };
    }

    public async Task<CommitHistoryResponseDto> GetHistoryAsync(string repoName, UserInfoDto userInfo)
    {
        ValidateRepositoryName(repoName);
        ValidateUserInfo(userInfo.Id, userInfo.Name, userInfo.Email);

        await EnsureRepositoryAccessAsync(repoName, userInfo.Id);

        var repoPath = Path.Combine(_reposRootPath, repoName);
        var commits = new List<CommitDto>();

        using var repo = new GitRepository(repoPath);
        foreach (var commit in repo.Commits)
        {
            commits.Add(new CommitDto
            {
                Id = commit.Id.ToString(),
                Author = commit.Author.Name,
                Email = commit.Author.Email,
                Message = commit.Message,
                Date = commit.Author.When
            });
        }

        return new CommitHistoryResponseDto
        {
            Count = commits.Count,
            Commits = commits
        };
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

        var repoPath = Path.Combine(_reposRootPath, repoName);

        if (Directory.Exists(repoPath))
        {
            Directory.Delete(repoPath, recursive: true);
        }

        await _repositoryRepository.DeleteAsync(repository.Id);

        _logger.LogInformation("Successfully deleted repository: {RepoName}", repoName);
    }

    public async Task<Stream> DownloadRepositoryAsync(string repoName, UserInfoDto userInfo)
    {
        ValidateRepositoryName(repoName);
        ValidateUserInfo(userInfo.Id, userInfo.Name, userInfo.Email);

        await EnsureRepositoryAccessAsync(repoName, userInfo.Id);

        var repoPath = Path.Combine(_reposRootPath, repoName);

        if (!GitRepository.IsValid(repoPath))
        {
            throw new Exceptions.RepositoryNotFoundException(repoName);
        }

        var zipPath = Path.GetTempFileName() + ".zip";
        ZipFile.CreateFromDirectory(repoPath, zipPath);

        return new FileStream(zipPath, FileMode.Open, FileAccess.Read, FileShare.Read, 4096, FileOptions.DeleteOnClose);
    }

    public async Task<List<FileInfoDto>> GetRepositoryFilesAsync(string repoName, UserInfoDto userInfo)
    {
        ValidateRepositoryName(repoName);
        ValidateUserInfo(userInfo.Id, userInfo.Name, userInfo.Email);

        await EnsureRepositoryAccessAsync(repoName, userInfo.Id);

        var repoPath = Path.Combine(_reposRootPath, repoName);
        var root = new DirectoryInfo(repoPath);

        if (!root.Exists)
        {
            return new List<FileInfoDto>();
        }

        return GetDirectoryContents(root, repoPath);
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

    private List<FileInfoDto> GetDirectoryContents(DirectoryInfo directory, string basePath)
    {
        var contents = new List<FileInfoDto>();

        // Add files
        foreach (var file in directory.GetFiles())
        {
            // Skip .git directory contents
            if (file.DirectoryName != null && file.DirectoryName.Contains(Path.Combine(basePath, ".git")))
            {
                continue;
            }

            contents.Add(new FileInfoDto
            {
                Name = file.Name,
                Path = Path.GetRelativePath(basePath, file.FullName),
                Type = "file",
                Size = file.Length,
                LastModified = file.LastWriteTimeUtc
            });
        }

        // Add directories
        foreach (var dir in directory.GetDirectories())
        {
            // Skip .git directory
            if (dir.Name == ".git")
            {
                continue;
            }

            contents.Add(new FileInfoDto
            {
                Name = dir.Name,
                Path = Path.GetRelativePath(basePath, dir.FullName),
                Type = "directory",
                LastModified = dir.LastWriteTimeUtc,
                Contents = GetDirectoryContents(dir, basePath)
            });
        }

        return contents;
    }
}

