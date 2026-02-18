namespace FruityGitServer.DTOs;

public class FileInfoDto
{
    public string Name { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public long? Size { get; set; }
    public DateTime LastModified { get; set; }
    public List<FileInfoDto>? Contents { get; set; }
}

