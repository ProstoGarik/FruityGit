using FruityGitServer.DTOs;
using FruityGitServer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FruityGitServer.Controllers;

/// <summary>
/// Controller for managing repository metadata.
/// All git operations are handled by Gitea directly.
/// </summary>
[ApiController]
[Route("api/git")]
[Authorize]
public class GitController : ControllerBase
{
    private readonly IGitService _gitService;
    private readonly ILogger<GitController> _logger;

    public GitController(IGitService gitService, ILogger<GitController> logger)
    {
        _gitService = gitService;
        _logger = logger;
    }

    /// <summary>
    /// Creates repository metadata. The actual git repository should be created in Gitea.
    /// </summary>
    [HttpPost("{repoName}/init")]
    public async Task<IActionResult> InitializeRepository(string repoName, [FromBody] RepositoryInitRequest request)
    {
        var result = await _gitService.CreateRepositoryMetadataAsync(repoName, request);
        return Ok(result);
    }

    /// <summary>
    /// Gets list of repositories (metadata only).
    /// </summary>
    [HttpPost("repositories")]
    public async Task<IActionResult> GetRepositories([FromBody] UserInfoDto userInfo)
    {
        var result = await _gitService.GetRepositoriesAsync(userInfo);
        return Ok(result);
    }

    /// <summary>
    /// Gets Gitea repository URL for cloning/pushing.
    /// </summary>
    [HttpPost("{repoName}/url")]
    public async Task<IActionResult> GetRepositoryUrl(string repoName, [FromBody] UserInfoDto userInfo)
    {
        var url = await _gitService.GetGiteaRepositoryUrlAsync(repoName, userInfo);
        return Ok(new { Url = url });
    }

    /// <summary>
    /// Deletes repository metadata.
    /// Note: The actual repository in Gitea should be deleted separately.
    /// </summary>
    [HttpPost("{repoName}/delete")]
    public async Task<IActionResult> DeleteRepository(string repoName, [FromBody] UserInfoDto userInfo)
    {
        await _gitService.DeleteRepositoryAsync(repoName, userInfo);
        return Ok(new { Success = true, Message = $"Repository metadata for {repoName} deleted successfully. Please delete the repository in Gitea separately." });
    }
}

