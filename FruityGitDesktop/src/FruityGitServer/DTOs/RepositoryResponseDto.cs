namespace FruityGitServer.DTOs;

public class RepositoryResponseDto
{
    public bool Success { get; set; }
    public string RepositoryName { get; set; } = string.Empty;
    public bool IsPrivate { get; set; }
    public string? Path { get; set; }
}

