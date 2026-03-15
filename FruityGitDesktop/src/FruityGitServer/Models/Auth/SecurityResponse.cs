namespace FruityGitServer.Models.Auth;

public class SecurityResponse
{
    public User? User { get; init; }
    public required string Token { get; init; }
    public required string RefreshToken { get; init; }
    public string? GiteaToken { get; set; }
}
