using FruityGitServer.DTOs;
using FruityGitServer.Models;
using FruityGitServer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
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
    private readonly UserManager<User> _userManager;
    private readonly GiteaService _giteaService;
    private readonly ILogger<GitController> _logger;

    public GitController(
        IGitService gitService,
        UserManager<User> userManager,
        GiteaService giteaService,
        ILogger<GitController> logger)
    {
        _gitService = gitService;
        _userManager = userManager;
        _giteaService = giteaService;
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

    /// <summary>
    /// Allows a user (by email) to push to a repository by granting write collaborator permission in Gitea.
    /// Only repository owner can grant this permission.
    /// </summary>
    [HttpPost("{owner}/{repoName}/allow-user")]
    public async Task<IActionResult> AllowUser(string owner, string repoName, [FromBody] AllowUserRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(new { Success = false, Message = "Email is required." });
        }

        var currentUserName = User.FindFirst("name")?.Value;
        if (string.IsNullOrWhiteSpace(currentUserName))
        {
            return Unauthorized(new { Success = false, Message = "User identity is missing." });
        }

        if (!string.Equals(currentUserName, owner, StringComparison.OrdinalIgnoreCase))
        {
            return Forbid();
        }

        var targetUser = await _userManager.FindByEmailAsync(request.Email.Trim());
        if (targetUser == null || string.IsNullOrWhiteSpace(targetUser.UserName))
        {
            return NotFound(new { Success = false, Message = $"User with email '{request.Email}' not found." });
        }

        var collaboratorAdded = await _giteaService.AddRepositoryCollaboratorAsync(
            owner,
            repoName,
            targetUser.UserName,
            "write");

        if (!collaboratorAdded)
        {
            _logger.LogWarning("Failed to grant write access for {TargetEmail} ({TargetUserName}) to {Owner}/{RepoName}",
                request.Email, targetUser.UserName, owner, repoName);
            return BadRequest(new { Success = false, Message = "Failed to grant repository write access." });
        }

        return Ok(new
        {
            Success = true,
            Message = $"User {targetUser.Email} can now push to {owner}/{repoName}.",
            UserName = targetUser.UserName,
            Email = targetUser.Email
        });
    }
}

