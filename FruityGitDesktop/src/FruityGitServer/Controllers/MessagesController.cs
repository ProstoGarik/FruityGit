using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using LibGit2Sharp;
using System;
using System.IO;
using System.Threading.Tasks;
using System.IO.Compression;
using System.Linq;

[ApiController]
[Route("api/git")]
public class GitController : ControllerBase
{
    private readonly string _reposRootPath;
    private readonly ILogger<GitController> _logger;
    private readonly DataContext _context;
    private const int MaxFileSize = 100 * 1024 * 1024; // 100MB

    public GitController(
        IWebHostEnvironment env, 
        ILogger<GitController> logger,
        DataContext context)
    {
        _reposRootPath = Path.Combine(env.ContentRootPath, "ReposFolder");
        _logger = logger;
        _context = context;
        Directory.CreateDirectory(_reposRootPath);
    }

    [HttpPost("{repoName}/init")]
    public async Task<IActionResult> InitializeRepository(string repoName, [FromBody] RepositoryInitRequest request)
    {
        try
        {
            if (request == null || string.IsNullOrEmpty(request.UserId))
            {
                return BadRequest("User information is required");
            }

            if (!IsValidRepoName(repoName))
            {
                return BadRequest("Invalid repository name");
            }

            _logger.LogInformation($"Initializing repository: {repoName}");
            
            var repoPath = Path.Combine(_reposRootPath, repoName);

            // Check if this user already has a repository with this name
            var userRepoExists = await _context.Repositories
                .AnyAsync(r => r.Name == repoName && r.AuthorId == request.UserId);
                
            if (userRepoExists)
            {
                return BadRequest("You already have a repository with this name");
            }

            // Check if the physical directory exists (global check)
            if (Directory.Exists(repoPath) && LibGit2Sharp.Repository.IsValid(repoPath))
            {
                return BadRequest("A repository with this name already exists in the system");
            }

            if (Directory.Exists(repoPath))
            {
                Directory.Delete(repoPath, true);
            }

            Directory.CreateDirectory(repoPath);
            LibGit2Sharp.Repository.Init(repoPath);

            var repository = new Repository
            {
                Name = repoName,
                DirectoryPath = repoPath,
                AuthorId = request.UserId,
                IsPrivate = request.IsPrivate,
                CreatedAt = DateTime.UtcNow
            };

            _context.Repositories.Add(repository);
            await _context.SaveChangesAsync();

            return Ok(new 
            {
                Success = true,
                RepositoryName = repoName,
                IsPrivate = request.IsPrivate,
                Path = repoPath
            });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error initializing repository: {ex}");
            return StatusCode(500, $"An error occurred: {ex.Message}");
        }
    }

    [HttpPost("{repoName}/commit")]
    public async Task<IActionResult> Commit(string repoName, [FromForm] CommitRequestDto request)
    {
        try
        {
            _logger.LogInformation($"Commiting for user: {request.UserInfo.Name}");
            _logger.LogInformation($"Commiting for repo: {repoName}");
            _logger.LogInformation($"Commiting with summary: {request.Summary}");

            if (request?.UserInfo == null || string.IsNullOrEmpty(request.UserInfo.Id))
            {
                return BadRequest("Complete user information is required");
            }

            if (!IsValidRepoName(repoName))
            {
                return BadRequest("Invalid repository name");
            }

            var accessCheck = await CheckRepositoryAccess(repoName, request.UserInfo.Id);
            if (accessCheck != null) return accessCheck;

            if (request.File == null || request.File.Length == 0)
            {
                return BadRequest("No file was uploaded");
            }

            if (request.File.Length > MaxFileSize)
            {
                return BadRequest($"File size exceeds maximum limit of {MaxFileSize} bytes");
            }

            var fileName = Path.GetFileName(request.File.FileName);
            if (string.IsNullOrEmpty(fileName))
            {
                return BadRequest("Invalid file name");
            }

            var repoPath = Path.Combine(_reposRootPath, repoName);
            var filePath = Path.Combine(repoPath, fileName);

            using (var repo = new LibGit2Sharp.Repository(repoPath))
            {
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await request.File.CopyToAsync(stream);
                }

                Commands.Stage(repo, filePath);

                var commitMessage = $"{request.Summary} _summEnd_ {request.Description}";
                var signature = new Signature(request.UserInfo.Name, request.UserInfo.Email, DateTimeOffset.Now);
                repo.Commit(commitMessage, signature, signature);

                return Ok(new 
                {
                    Success = true,
                    FileName = fileName,
                    CommitMessage = commitMessage
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error during commit: {ex}");
            return StatusCode(500, new 
            {
                Error = "Commit failed",
                Message = ex.Message
            });
        }
    }

    [HttpPost("repositories")]
    public async Task<IActionResult> GetRepositories([FromBody] UserInfoDto userInfo)
    {
        try
        {
            if (userInfo == null || string.IsNullOrEmpty(userInfo.Id))
            {
                return BadRequest("User information is required");
            }

            _logger.LogInformation($"Searching repositories for UserId: {userInfo.Id}");

            var dbRepos = await _context.Repositories
                .Where(r => !r.IsPrivate || r.AuthorId == userInfo.Id)
                .Select(r => r.Name)
                .ToListAsync();

            if (!Directory.Exists(_reposRootPath))
            {
                return Ok(new List<string>());
            }

            var validRepos = Directory.GetDirectories(_reposRootPath)
                .Where(dir => LibGit2Sharp.Repository.IsValid(dir))
                .Select(dir => Path.GetRelativePath(_reposRootPath, dir))
                .Where(repoName => dbRepos.Contains(repoName))
                .ToList();

            return Ok(new
            {
                Count = validRepos.Count,
                Repositories = validRepos
            });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting repositories: {ex}");
            return StatusCode(500, new
            {
                Error = "Failed to retrieve repositories",
                Message = ex.Message
            });
        }
    }

    [HttpPost("{repoName}/history")]
    public async Task<IActionResult> GetHistory(string repoName, [FromBody] UserInfoDto userInfo)
    {
        try
        {
            if (userInfo == null || string.IsNullOrEmpty(userInfo.Id))
            {
                return BadRequest("User information is required");
            }

            if (!IsValidRepoName(repoName))
            {
                return BadRequest("Invalid repository name");
            }

            var accessCheck = await CheckRepositoryAccess(repoName, userInfo.Id);
            if (accessCheck != null) return accessCheck;

            var repoPath = Path.Combine(_reposRootPath, repoName);
            var commitHistory = new List<object>();

            using (var repo = new LibGit2Sharp.Repository(repoPath))
            {
                foreach (var commit in repo.Commits)
                {
                    commitHistory.Add(new
                    {
                        Id = commit.Id.ToString(),
                        Author = commit.Author.Name,
                        Email = commit.Author.Email,
                        Message = commit.Message,
                        Date = commit.Author.When
                    });
                }
            }

            return Ok(new
            {
                Count = commitHistory.Count,
                Commits = commitHistory
            });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting history: {ex}");
            return StatusCode(500, new
            {
                Error = "Failed to retrieve commit history",
                Message = ex.Message
            });
        }
    }

    [HttpPost("{repoName}/delete")]
    public async Task<IActionResult> DeleteRepository(string repoName, [FromBody] UserInfoDto userInfo)
    {
        try
        {
            if (userInfo == null || string.IsNullOrEmpty(userInfo.Id))
            {
                return BadRequest("User information is required");
            }

            if (!IsValidRepoName(repoName))
            {
                return BadRequest("Invalid repository name");
            }

            var repository = await _context.Repositories
                .FirstOrDefaultAsync(r => r.Name == repoName && r.AuthorId == userInfo.Id);
                
            if (repository == null)
            {
                return NotFound(new
                {
                    Error = "Repository not found",
                    Message = "Either the repository doesn't exist or you don't have permission to delete it"
                });
            }

            var repoPath = Path.Combine(_reposRootPath, repoName);

            if (Directory.Exists(repoPath))
            {
                Directory.Delete(repoPath, recursive: true);
            }

            _context.Repositories.Remove(repository);
            await _context.SaveChangesAsync();

            _logger.LogInformation($"Successfully deleted repository: {repoName}");
            return Ok(new
            {
                Success = true,
                Message = $"Repository {repoName} deleted successfully"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error deleting repository {repoName}: {ex}");
            return StatusCode(500, new
            {
                Error = "Delete failed",
                Message = ex.Message
            });
        }
    }

    [HttpPost("{repoName}/download")]
    public async Task<IActionResult> DownloadRepository(string repoName, [FromBody] UserInfoDto userInfo)
    {
        string zipPath = null;
        try
        {
            if (userInfo == null || string.IsNullOrEmpty(userInfo.Id))
            {
                return BadRequest("User information is required");
            }

            if (!IsValidRepoName(repoName))
            {
                return BadRequest("Invalid repository name");
            }

            var accessCheck = await CheckRepositoryAccess(repoName, userInfo.Id);
            if (accessCheck != null) return accessCheck;

            var repoPath = Path.Combine(_reposRootPath, repoName);
            
            if (!LibGit2Sharp.Repository.IsValid(repoPath))
            {
                return NotFound(new
                {
                    Error = "Repository not found",
                    Message = "The requested repository does not exist"
                });
            }

            zipPath = Path.GetTempFileName() + ".zip";
            ZipFile.CreateFromDirectory(repoPath, zipPath);

            var fileStream = new FileStream(zipPath, FileMode.Open, FileAccess.Read);
            return File(fileStream, "application/zip", $"{repoName}.zip");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error downloading repository: {ex}");
            return StatusCode(500, new
            {
                Error = "Download failed",
                Message = ex.Message
            });
        }
        finally
        {
            if (zipPath != null && System.IO.File.Exists(zipPath))
            {
                System.IO.File.Delete(zipPath);
            }
        }
    }

    [HttpPost("{repoName}/files")]
    public async Task<IActionResult> GetRepositoryFiles(string repoName, [FromBody] UserInfoDto userInfo)
    {
        try
        {
            if (userInfo == null || string.IsNullOrEmpty(userInfo.Id))
            {
                return BadRequest("User information is required");
            }

            if (!IsValidRepoName(repoName))
            {
                return BadRequest("Invalid repository name");
            }

            var accessCheck = await CheckRepositoryAccess(repoName, userInfo.Id);
            if (accessCheck != null) return accessCheck;

            var repoPath = Path.Combine(_reposRootPath, repoName);
            var root = new DirectoryInfo(repoPath);
            
            if (!root.Exists)
            {
                return Ok(new { Files = new List<object>() });
            }

            var files = GetDirectoryContents(root, repoPath);

            return Ok(new { Files = files });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting repository files: {ex}");
            return StatusCode(500, new
            {
                Error = "Failed to retrieve repository files",
                Message = ex.Message
            });
        }
    }


    [HttpGet("users/search")]
    public async Task<IActionResult> SearchUsers([FromQuery] string query)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(query) || query.Length < 3)
            {
                return BadRequest("Search query must be at least 3 characters");
            }

            var users = await _context.Users
                .Where(u => u.UserName.Contains(query) || u.Email.Contains(query))
                .Select(u => new
                {
                    Id = u.Id,
                    UserName = u.UserName,
                    Email = u.Email
                })
                .ToListAsync();

            return Ok(new
            {
                Count = users.Count,
                Users = users
            });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error searching users: {ex}");
            return StatusCode(500, new
            {
                Error = "Search failed",
                Message = ex.Message
            });
        }
    }

    [HttpGet("users/{userId}/repositories")]
    public async Task<IActionResult> GetUserRepositories(string userId)
    {
        try
        {
            var repositories = await _context.Repositories
                .Where(r => r.AuthorId == userId && !r.IsPrivate)
                .Select(r => new
                {
                    r.Name,
                    r.Description,
                    r.CreatedAt,
                    r.IsPrivate,
                    AuthorName = r.Author.UserName
                })
                .ToListAsync();

            return Ok(new
            {
                Count = repositories.Count,
                Repositories = repositories
            });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting user repositories: {ex}");
            return StatusCode(500, new
            {
                Error = "Failed to retrieve repositories",
                Message = ex.Message
            });
        }
    }

    private async Task<IActionResult> CheckRepositoryAccess(string repoName, string userId)
    {
        var repository = await _context.Repositories
            .FirstOrDefaultAsync(r => r.Name == repoName);

        if (repository == null)
        {
            return NotFound(new
            {
                Error = "Repository not found",
                Message = "The requested repository does not exist"
            });
        }

        if (repository.IsPrivate && repository.AuthorId != userId)
        {
            return Unauthorized(new
            {
                Error = "Access denied",
                Message = "You don't have permission to access this private repository"
            });
        }

        return null;
    }

    private bool IsValidRepoName(string repoName)
    {
        if (string.IsNullOrWhiteSpace(repoName)) return false;
        return repoName.IndexOfAny(Path.GetInvalidFileNameChars()) < 0;
    }

    private List<object> GetDirectoryContents(DirectoryInfo directory, string basePath)
    {
        var contents = new List<object>();
        
        // Add files
        foreach (var file in directory.GetFiles())
        {
            // Skip .git directory contents
            if (file.DirectoryName.Contains(Path.Combine(basePath, ".git")))
            {
                continue;
            }

            contents.Add(new
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

            contents.Add(new
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

public class CommitRequestDto
{
    public IFormFile File { get; set; }
    public string Summary { get; set; }
    public string Description { get; set; }
    public UserInfoDto UserInfo { get; set; }
}

public class UserInfoDto
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
    }

public class RepositoryInitRequest
{
    public bool IsPrivate { get; set; }
    public string UserId { get; set; }
}