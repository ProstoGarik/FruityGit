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
using ZipFile;


[ApiController]
[Route("api/git")]
public class GitController : ControllerBase
{
    private readonly string _reposRootPath;
    private readonly ILogger<GitController> _logger;

    public GitController(IWebHostEnvironment env, ILogger<GitController> logger)
    {
        _reposRootPath = Path.Combine(env.ContentRootPath, "ReposFolder");
        _logger = logger;
    }

    [HttpPost("{repoName}/init")]
    public async Task<IActionResult> InitializeRepository(string repoName)
    {
        _logger.LogInformation($"Attempting to initialize repository at: {repoName}");

        try
        {
            var repoPath = Path.Combine(_reposRootPath, repoName);
            Directory.CreateDirectory(_reposRootPath);

            if (LibGit2Sharp.Repository.IsValid(repoPath))
            {
                _logger.LogInformation("Repository already exists");
                return BadRequest("Repository already exists.");
            }

            if (Directory.Exists(Path.Combine(repoPath, ".git")))
            {
                _logger.LogWarning("Found not valid .git directory. Deleting...");
                Directory.Delete(Path.Combine(repoPath, ".git"), true);
            }

            _logger.LogInformation("Initializing new repository...");
            LibGit2Sharp.Repository.Init(repoPath);
            return Ok("Repository initialized.");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error initializing repository: {ex}");
            return StatusCode(500, $"Error initializing repository: {ex.Message}");
        }
    }

    [HttpPost("{repoName}/commit")]
    public async Task<IActionResult> Commit(string repoName, [FromForm] CommitRequest request)
    {
        try
        {
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

                var signature = new Signature(request.UserName, request.UserEmail, DateTimeOffset.Now);
                repo.Commit(commitMessage, signature, signature);

                return Ok("Commit created.");
            }
        }
        catch (RepositoryNotFoundException)
        {
            return BadRequest("Repository not found. Initialize the repository first.");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error during commit: {ex}");
            return StatusCode(500, $"An error occurred: {ex.Message}");
        }
    }

    [HttpGet("repositories")]
    public async Task<IActionResult> GetRepositories()
    {
        try
        {
            _logger.LogInformation($"Getting list of repositories from: {_reposRootPath}");

            if (!Directory.Exists(_reposRootPath))
            {
                _logger.LogInformation("Repositories directory doesn't exist yet");
                return Ok(new List<string>());
            }

            var repositories = Directory.GetDirectories(_reposRootPath)
                .Where(dir => LibGit2Sharp.Repository.IsValid(dir))
                .Select(dir => Path.GetRelativePath(_reposRootPath, dir))
                .ToList();

            _logger.LogInformation($"Found {repositories.Count} repositories");
            return Ok(repositories);
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting repositories list: {ex}");
            return StatusCode(500, $"Error getting repositories: {ex.Message}");
        }
    }


    [HttpGet("{repoName}/history")]
    public async Task<IActionResult> GetHistory(string repoName)
    {
        try
        {

            var repoPath = Path.Combine(_reposRootPath, repoName);
            var commitHistory = new List<string>();

            using (var repo = new LibGit2Sharp.Repository(repoPath))
            {
                foreach (var commit in repo.Commits)
                {
                    commitHistory.Add($"{commit.Id} _idEnd_ {commit.Author.Name} _usEnd_ {commit.Message} _descEnd_ {commit.Author.When}");
                }
                //repo.Diff.Compare();

            }

            return Ok(commitHistory);
        }
        catch (RepositoryNotFoundException)
        {
            return BadRequest("Repository not found. Initialize the repository first.");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error getting history: {ex}");
            return StatusCode(500, $"An error occurred: {ex.Message}");
        }
    }

    [HttpDelete("{repoName}")]
    public async Task<IActionResult> DeleteRepository(string repoName)
    {
        try
        {
            var repoPath = Path.Combine(_reposRootPath, repoName);

            Directory.Delete(repoPath, recursive: true);

            _logger.LogInformation($"Successfully deleted repository: {repoName}");
            return Ok($"Repository {repoName} deleted successfully");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error deleting repository {repoName}: {ex}");
            return StatusCode(500, $"Unexpected error: {ex.Message}");
        }
    }

    [HttpGet("{repoName}/download")]
    public IActionResult DownloadRepository(string repoName)
    {
        try
        {
            var repoPath = Path.Combine(_reposRootPath, repoName);
            
            if (!LibGit2Sharp.Repository.IsValid(repoPath))
            {
                return NotFound("Repository not found");
            }

            // Create a temporary zip file name
            var tempFileName = Path.GetTempFileName();
            var zipPath = tempFileName + ".zip";

            // Create zip archive
            ZipFile.CreateFromDirectory(repoPath, zipPath);

            // Return the file (will be deleted after sending)
            var fileStream = new FileStream(zipPath, FileMode.Open, FileAccess.Read);
            return File(fileStream, "application/zip", $"{repoName}.zip");
        }
        catch (Exception ex)
        {
            _logger.LogError($"Error downloading repository: {ex}");
            return StatusCode(500, $"Error downloading repository: {ex.Message}");
        }
    }

}

public class CommitRequest
{
    public string Summary { get; set; }
    public string Description { get; set; }
    public string UserName { get; set; }
    public string UserEmail { get; set; }
    public IFormFile File { get; set; }
}