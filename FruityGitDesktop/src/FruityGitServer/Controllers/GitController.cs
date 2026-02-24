using FruityGitServer.DTOs;
using FruityGitServer.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FruityGitServer.Controllers;

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

    [HttpPost("{repoName}/init")]
    public async Task<IActionResult> InitializeRepository(string repoName, [FromBody] RepositoryInitRequest request)
    {
        var result = await _gitService.InitializeRepositoryAsync(repoName, request);
        return Ok(result);
    }

    [HttpPost("{repoName}/commit")]
    public async Task<IActionResult> Commit(string repoName, [FromForm] CommitRequestDto request)
    {
        var result = await _gitService.CommitAsync(repoName, request);
        return Ok(result);
    }

    [HttpPost("repositories")]
    public async Task<IActionResult> GetRepositories([FromBody] UserInfoDto userInfo)
    {
        var result = await _gitService.GetRepositoriesAsync(userInfo);
        return Ok(result);
    }

    [HttpPost("{repoName}/history")]
    public async Task<IActionResult> GetHistory(string repoName, [FromBody] UserInfoDto userInfo)
    {
        var result = await _gitService.GetHistoryAsync(repoName, userInfo);
        return Ok(result);
    }

    [HttpPost("{repoName}/delete")]
    public async Task<IActionResult> DeleteRepository(string repoName, [FromBody] UserInfoDto userInfo)
    {
        await _gitService.DeleteRepositoryAsync(repoName, userInfo);
        return Ok(new { Success = true, Message = $"Repository {repoName} deleted successfully" });
    }

    [HttpPost("{repoName}/download")]
    public async Task<IActionResult> DownloadRepository(string repoName, [FromBody] UserInfoDto userInfo)
    {
        var stream = await _gitService.DownloadRepositoryAsync(repoName, userInfo);
        return File(stream, "application/zip", $"{repoName}.zip");
    }

    [HttpPost("{repoName}/files")]
    public async Task<IActionResult> GetRepositoryFiles(string repoName, [FromBody] UserInfoDto userInfo)
    {
        var files = await _gitService.GetRepositoryFilesAsync(repoName, userInfo);
        return Ok(new { Files = files });
    }
}

