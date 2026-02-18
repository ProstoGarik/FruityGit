namespace FruityGitServer.DTOs;

public class CommitResponseDto
{
    public bool Success { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string CommitMessage { get; set; } = string.Empty;
}

