﻿using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;
using LibGit2Sharp;
using System;
using System.IO;
using System.Threading.Tasks;
using Database.Context;

[ApiController]
[Route("api/git")]
[Authorize]
public class GitController : ControllerBase
{
    private readonly string _reposRootPath;
    private readonly AppDbContext _context;
    private readonly ILogger<GitController> _logger;

    public GitController(IWebHostEnvironment env, AppDbContext context, ILogger<GitController> logger)
    {
        _reposRootPath = Path.Combine(env.ContentRootPath, "ReposFolder");
        _context = context;
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
}

public class CommitRequest
{
    public string Summary { get; set; }
    public string Description { get; set; }
    public string UserName { get; set; }
    public string UserEmail { get; set; }
    public IFormFile File { get; set; }
}