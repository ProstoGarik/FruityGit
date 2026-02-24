namespace FruityGitServer.Authentication;

public class JwtOptions
{
    public const string SectionName = "Jwt";
    public string Secret { get; set; } = "";
    public int ExpiryMinutes { get; set; } = 60;
}
