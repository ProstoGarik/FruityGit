using LibGit2Sharp;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using Microsoft.AspNetCore.Http;

[ApiController]
[Route("api/git")]
public class GitController(IWebHostEnvironment env) : ControllerBase
{
    private readonly string _reposRootPath = Path.Combine(env.ContentRootPath, "ReposFolder");

    [HttpPost("{repoName}/init")]
    public IActionResult InitializeRepository(string repoName)
    {
        var logger = HttpContext.RequestServices.GetRequiredService<ILogger<GitController>>();
        var repoPath = Path.Combine(_reposRootPath, repoName);

        logger.LogInformation($"Attempting to initialize repository at: {repoPath}");

        try
        {
            Directory.CreateDirectory(_reposRootPath);

            if (Repository.IsValid(repoPath))
            {
                logger.LogInformation("Repository already exists");
                return BadRequest("Repository already exists.");
            }

            if (Directory.Exists(Path.Combine(repoPath, ".git")))
            {
                logger.LogWarning("Found not valid .git directory. Deleting...");
                Directory.Delete(Path.Combine(repoPath, ".git"), true);
            }

            logger.LogInformation("Initializing new repository...");
            Repository.Init(repoPath);
            return Ok("Repository initialized.");
        }
        catch (Exception ex)
        {
            logger.LogError($"Error initializing repository: {ex}");
            return StatusCode(500, $"Error initializing repository: {ex.Message}");
        }
    }

    [HttpPost("{repoName}/commit")]
    public IActionResult Commit(string repoName, [FromForm] CommitRequest request)
    {
        var repoPath = Path.Combine(_reposRootPath, repoName);

        try
        {
            using (var repo = new Repository(repoPath))
            {
                if (request.File == null || request.File.Length == 0)
                {
                    return BadRequest("File was not uploaded.");
                }

                string filePath = Path.Combine(repoPath, request.File.FileName);
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    request.File.CopyTo(stream);
                }

                Commands.Stage(repo, filePath);

                string commitMessage = $"{request.Summary}\n\n{request.Description}";

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
            return StatusCode(500, $"An error occurred: {ex.Message}");
        }
    }

    [HttpGet("{repoName}/history")]
    public IActionResult GetHistory(string repoName)
    {
        var repoPath = Path.Combine(_reposRootPath, repoName);
        var commitHistory = new List<string>();

        try
        {
            using (var repo = new Repository(repoPath))
            {
                foreach (var commit in repo.Commits)
                {
                    commitHistory.Add($"{commit.Id} - {commit.Message} - {commit.Author.When}");
                }
            }

            return Ok(commitHistory);
        }
        catch (RepositoryNotFoundException)
        {
            return BadRequest("Repository not found. Initialize the repository first.");
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"An error occurred: {ex.Message}");
        }
    }

    [HttpGet("repositories")]
    public IActionResult ListRepositories()
    {
        try
        {
            if (!Directory.Exists(_reposRootPath))
            {
                return Ok(new List<string>()); // Return empty list if directory doesn't exist
            }

            var repos = Directory.GetDirectories(_reposRootPath)
                .Where(dir => Repository.IsValid(dir))
                .Select(Path.GetFileName)
                .ToList();

            return Ok(repos);
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"An error occurred: {ex.Message}");
        }
    }

    [HttpDelete("{repoName}")]
    public IActionResult DeleteRepository(string repoName)
    {
        var logger = HttpContext.RequestServices.GetRequiredService<ILogger<GitController>>();
        var repoPath = Path.Combine(_reposRootPath, repoName);

        logger.LogInformation($"Attempting to delete repository: {repoName} at path: {repoPath}");

        try
        {
            if (!Directory.Exists(repoPath) || !Repository.IsValid(repoPath))
            {
                logger.LogWarning($"Repository {repoName} not found or invalid");
                return NotFound($"Repository {repoName} not found or invalid");
            }

            using (var repo = new Repository(repoPath))
            {
                var status = repo.RetrieveStatus();
                if (!status.IsDirty)
                {
                    logger.LogWarning($"Repository {repoName} has uncommitted changes");
                    return BadRequest("Cannot delete repository with uncommitted changes");
                }
            }

            Directory.Delete(repoPath, recursive: true);

            logger.LogInformation($"Successfully deleted repository: {repoName}");
            return Ok($"Repository {repoName} deleted successfully");
        }
        catch (LibGit2SharpException ex)
        {
            logger.LogError($"Git error deleting repository {repoName}: {ex}");
            return StatusCode(500, $"Git error deleting repository: {ex.Message}");
        }
        catch (IOException ex)
        {
            logger.LogError($"IO error deleting repository {repoName}: {ex}");
            return StatusCode(500, $"IO error deleting repository: {ex.Message}");
        }
        catch (UnauthorizedAccessException ex)
        {
            logger.LogError($"Permission error deleting repository {repoName}: {ex}");
            return StatusCode(403, $"Permission denied: {ex.Message}");
        }
        catch (Exception ex)
        {
            logger.LogError($"Unexpected error deleting repository {repoName}: {ex}");
            return StatusCode(500, $"Unexpected error: {ex.Message}");
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