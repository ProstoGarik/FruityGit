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

                var signature = new Signature(request.UserName, request.UserEmail, DateTimeOffset.Now);
                repo.Commit(request.Message, signature, signature);

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
}

public class CommitRequest
{
    public string Message { get; set; }
    public string UserName { get; set; }
    public string UserEmail { get; set; }
    public IFormFile File { get; set; }
}