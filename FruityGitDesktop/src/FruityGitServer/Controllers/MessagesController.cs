using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using LibGit2Sharp;
using System;
using System.IO;
using System.Threading.Tasks;
using System.IO.Compression;

[ApiController]
[Route("api/git")]
public class GitController : ControllerBase
{
    private readonly string _reposRootPath;
    private readonly ILogger<GitController> _logger;
    private readonly DataContext _context;

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

    public class UserInfoDto
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
    }

    [HttpPost("{repoName}/init")]
    public async Task<IActionResult> InitializeRepository(string repoName, [FromBody] RepositoryInitRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userEmail = User.FindFirstValue(ClaimTypes.Email);
            
            if (string.IsNullOrEmpty(userId))
            {
                return BadRequest("User information is required");
            }

            _logger.LogInformation($"Initializing repository: {repoName}");
            
            var repoPath = Path.Combine(_reposRootPath, repoName);
            Directory.CreateDirectory(_reposRootPath);

            if (LibGit2Sharp.Repository.IsValid(repoPath) || 
                await _context.Repositories.AnyAsync(r => r.Name == repoName))
            {
                return BadRequest("Repository already exists");
            }

            var gitPath = Path.Combine(repoPath, ".git");
            if (Directory.Exists(gitPath))
            {
                Directory.Delete(gitPath, true);
            }

            LibGit2Sharp.Repository.Init(repoPath);

            var repository = new Repository
            {
                Name = repoName,
                DirectoryPath = repoPath,
                AuthorId = userId,  // Use Id instead of Email
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
                Author = User.Identity.Name // Get from authenticated user
            });
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error initializing repository: {ex}");
            return StatusCode(500, $"An error occurred: {ex.Message}");
        }
    }

    [HttpPost("{repoName}/commit")]
    public async Task<IActionResult> Commit(string repoName, [FromForm] CommitRequest request)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var userEmail = User.FindFirstValue(ClaimTypes.Email);
            var userName = User.Identity.Name;

            var accessCheck = await CheckRepositoryAccess(repoName, userId);
            if (accessCheck != null) return accessCheck;

            var repoPath = Path.Combine(_reposRootPath, repoName);
            using (var repo = new LibGit2Sharp.Repository(repoPath))
            {
                if (request.File == null || request.File.Length == 0)
                {
                    return BadRequest("File was not uploaded.");
                }

                string filePath = Path.Combine(repoPath, request.File.FileName);
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await request.File.CopyToAsync(stream);
                }

                Commands.Stage(repo, filePath);

                string commitMessage = $"{request.Summary} _summEnd_ {request.Description}";

                var signature = new Signature(userName, userEmail, DateTimeOffset.Now);
                repo.Commit(commitMessage, signature, signature);

                return Ok("Commit created.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error during commit: {ex}");
            return StatusCode(500, $"An error occurred: {ex.Message}");
        }
    }

    [HttpPost("repositories")]
    public async Task<IActionResult> GetRepositories()
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            var dbRepos = await _context.Repositories
                .Where(r => !r.IsPrivate || r.AuthorId == userId)
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

            return Ok(validRepos);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting repositories: {ex}");
            return StatusCode(500, "Error getting repositories");
        }
    }

    [HttpPost("{repoName}/history")]
    public async Task<IActionResult> GetHistory(string repoName, [FromBody] UserInfoDto userInfo)
    {
        try
        {
            if (userInfo == null || string.IsNullOrEmpty(userInfo.Email))
            {
                return BadRequest("User information is required");
            }

            var accessCheck = await CheckRepositoryAccess(repoName, userInfo.Email);
            if (accessCheck != null) return accessCheck;

            var repoPath = Path.Combine(_reposRootPath, repoName);
            var commitHistory = new List<string>();

            using (var repo = new LibGit2Sharp.Repository(repoPath))
            {
                foreach (var commit in repo.Commits)
                {
                    commitHistory.Add($"{commit.Id} _idEnd_ {commit.Author.Name} _usEnd_ {commit.Message} _descEnd_ {commit.Author.When}");
                }
            }

            return Ok(commitHistory);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting history: {ex}");
            return StatusCode(500, $"An error occurred: {ex.Message}");
        }
    }

    [HttpPost("{repoName}/delete")]
    public async Task<IActionResult> DeleteRepository(string repoName, [FromBody] UserInfoDto userInfo)
    {
        try
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            var repository = await _context.Repositories
                .FirstOrDefaultAsync(r => r.Name == repoName && r.AuthorId == userId);
                
            if (repository == null)
            {
                return NotFound("Repository not found or you don't have permission to delete it");
            }

            var repoPath = Path.Combine(_reposRootPath, repoName);

            if (Directory.Exists(repoPath))
            {
                Directory.Delete(repoPath, recursive: true);
            }

            _context.Repositories.Remove(repository);
            await _context.SaveChangesAsync();

            _logger.LogInformation($"Successfully deleted repository: {repoName}");
            return Ok($"Repository {repoName} deleted successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error deleting repository {repoName}: {ex}");
            return StatusCode(500, $"Unexpected error: {ex.Message}");
        }
    }

    [HttpPost("{repoName}/download")]
    public async Task<IActionResult> DownloadRepository(string repoName, [FromBody] UserInfoDto userInfo)
    {
        try
        {
            if (userInfo == null || string.IsNullOrEmpty(userInfo.Email))
            {
                return BadRequest("User information is required");
            }

            var accessCheck = await CheckRepositoryAccess(repoName, userInfo.Email);
            if (accessCheck != null) return accessCheck;

            var repoPath = Path.Combine(_reposRootPath, repoName);
            
            if (!LibGit2Sharp.Repository.IsValid(repoPath))
            {
                return NotFound("Repository not found");
            }

            var tempFileName = Path.GetTempFileName();
            var zipPath = tempFileName + ".zip";

            ZipFile.CreateFromDirectory(repoPath, zipPath);

            var fileStream = new FileStream(zipPath, FileMode.Open, FileAccess.Read);
            return File(fileStream, "application/zip", $"{repoName}.zip");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error downloading repository: {ex}");
            return StatusCode(500, $"Error downloading repository: {ex.Message}");
        }
    }

    private async Task<IActionResult> CheckRepositoryAccess(string repoName, string userId)
    {
        var repository = await _context.Repositories
            .Include(r => r.Author)
            .FirstOrDefaultAsync(r => r.Name == repoName);

        if (repository == null)
        {
            return NotFound("Repository not found");
        }

        if (repository.IsPrivate && repository.AuthorId != userId)
        {
            return Unauthorized("You don't have permission to access this repository");
        }

        return null;
    }
}

public class CommitRequest
{
    public string Summary { get; set; }
    public string Description { get; set; }
    public IFormFile File { get; set; }
    // Remove UserName/Email since we'll get from claims
}

public class RepositoryInitRequest
{
    public bool IsPrivate { get; set; }
    // Remove UserName/Email since we'll get from claims
}