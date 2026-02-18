namespace FruityGitServer.DTOs;

public class RepositoriesListResponseDto
{
    public int Count { get; set; }
    public List<string> Repositories { get; set; } = new();
}

