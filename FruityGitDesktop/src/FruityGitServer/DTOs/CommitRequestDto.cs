using Microsoft.AspNetCore.Http;

namespace FruityGitServer.DTOs;

public class CommitRequestDto
{
    public IFormFile? File { get; set; }
    public string Summary { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public UserInfoDto UserInfo { get; set; } = new();
}

