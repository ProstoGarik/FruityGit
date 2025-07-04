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
using System.IO.Compression;
using FruityGitServer.Context;
using Repository = FruityGitServer.Context.Repository;

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

    // Helper method to check repository access
    private async Task<IActionResult> CheckRepositoryAccess(string repoName, string userEmail)
    {
        var repository = await _context.Repositories
            .FirstOrDefaultAsync(r => r.Name == repoName);

        if (repository == null)
        {
            return NotFound("Repository not found");
        }

        if (repository.IsPrivate && repository.AuthorEmail != userEmail)
        {
            return Unauthorized("You don't have permission to access this repository");
        }

        return null; // Access granted
    }

    [HttpPost("{repoName}/init")]
    public async Task<IActionResult> InitializeRepository(string repoName, [FromBody] RepositoryInitRequest request)
    {
        try
        {
            _logger.LogInformation($"Initializing repository: {repoName}");
            var accessCheck = await CheckRepositoryAccess(repoName, request.UserEmail);
            if (accessCheck != null) return accessCheck;

            var repoPath = Path.Combine(_reposRootPath, repoName);

            Directory.CreateDirectory(_reposRootPath);

            // Check if repository exists
            if (LibGit2Sharp.Repository.IsValid(repoPath) || 
                await _context.Repositories.AnyAsync(r => r.Name == repoName))
            {
                return BadRequest("Repository already exists");
            }

            // Clean up partial .git if exists
            var gitPath = Path.Combine(repoPath, ".git");
            if (Directory.Exists(gitPath))
            {
                Directory.Delete(gitPath, true);
            }

            // Initialize repository
            LibGit2Sharp.Repository.Init(repoPath);

            // Create database record
            var repository = new FruityGitServer.Context.Repository
            {
                Name = repoName,
                DirectoryPath = repoPath,
                AuthorEmail = request.UserEmail,
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
                Author = request.UserName
            });
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

    [HttpPost("repositories")]
    public async Task<IActionResult> GetRepositories([FromBody] UserInfo userInfo)
    {
        try
        {
            _logger.LogInformation($"Getting repositories for user: {userInfo.Email}");

            if (!Directory.Exists(_reposRootPath))
            {
                return Ok(new List<string>());
            }

            // Get all repositories from database with their privacy settings
            var dbRepos = await _context.Repositories
                .Include(r => r.Author)
                .ToListAsync();

            // Filter repositories based on privacy and ownership
            var accessibleRepos = dbRepos
                .Where(r => !r.IsPrivate || r.AuthorEmail == userInfo.Email)
                .Select(r => r.Name)
                .ToList();

            // Verify these repositories exist in the filesystem
            var validRepos = Directory.GetDirectories(_reposRootPath)
                .Where(dir => LibGit2Sharp.Repository.IsValid(dir))
                .Select(dir => Path.GetRelativePath(_reposRootPath, dir))
                .Where(repoName => accessibleRepos.Contains(repoName))
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
    public async Task<IActionResult> GetHistory(string repoName, [FromBody] UserInfo userInfo)
    {
        try
        {
            // Verify user has access to the repository
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

    [HttpPost("{repoName}/delete")]
    public async Task<IActionResult> DeleteRepository(string repoName, [FromBody] UserInfo userInfo)
    {
        try
        {
            // Verify user owns the repository
            var repository = await _context.Repositories
                .FirstOrDefaultAsync(r => r.Name == repoName && r.AuthorEmail == userInfo.Email);
                
            if (repository == null)
            {
                return NotFound("Repository not found or you don't have permission to delete it");
            }

            var repoPath = Path.Combine(_reposRootPath, repoName);

            // Delete from filesystem
            if (Directory.Exists(repoPath))
            {
                Directory.Delete(repoPath, recursive: true);
            }

            // Delete from database
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
    public async Task<IActionResult> DownloadRepository(string repoName, [FromBody] UserInfo userInfo)
    {
        try
        {
            // Verify user has access to the repository
            var accessCheck = await CheckRepositoryAccess(repoName, userInfo.Email);
            if (accessCheck != null) return accessCheck;

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

public class UserInfo
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
    }

public class RepositoryInitRequest
{
    public string UserName { get; set; }
    public string UserEmail { get; set; }
    public bool IsPrivate { get; set; }
}