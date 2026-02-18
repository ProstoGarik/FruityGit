namespace FruityGitServer.DTOs;

public class RepositoryInitRequest
{
    public bool IsPrivate { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string UserEmail { get; set; } = string.Empty;
}

