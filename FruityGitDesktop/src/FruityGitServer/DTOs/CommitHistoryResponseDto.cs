namespace FruityGitServer.DTOs;

public class CommitHistoryResponseDto
{
    public int Count { get; set; }
    public List<CommitDto> Commits { get; set; } = new();
}

public class CommitDto
{
    public string Id { get; set; } = string.Empty;
    public string Author { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public DateTimeOffset Date { get; set; }
}

