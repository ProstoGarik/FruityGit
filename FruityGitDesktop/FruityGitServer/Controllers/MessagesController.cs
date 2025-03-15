using LibGit2Sharp;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;

[ApiController]
[Route("api/git/[controller]")]
public class GitController : ControllerBase
{
    private readonly string _repoPath = @"Z:\app\data";

    [HttpPost("init")]
    public IActionResult InitializeRepository()
    {
        if (!Repository.IsValid(_repoPath))
        {
            Repository.Init(_repoPath);
            return Ok("Repository initialized.");
        }

        return BadRequest("Repository already exists.");
    }

    [HttpPost("commit")]
    public IActionResult Commit([FromBody] CommitRequest request)
    {
        try
        {
            using (var repo = new Repository(_repoPath))
            {
                Commands.Stage(repo, "*");

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

    [HttpGet("history")]
    public IActionResult GetHistory()
    {
        var commitHistory = new List<string>();

        using (var repo = new Repository(_repoPath))
        {
            foreach (var commit in repo.Commits)
            {
                commitHistory.Add($"{commit.Id} - {commit.Message} - {commit.Author.When}");
            }
        }

        return Ok(commitHistory);
    }
}

public class CommitRequest
{
    public string Message { get; set; }
    public string UserName { get; set; }
    public string UserEmail { get; set; }
}