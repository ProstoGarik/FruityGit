using Microsoft.AspNetCore.Identity;

namespace FruityGitServer.Models;

public class User : IdentityUser
{
    public string? RefreshToken { get; set; }
    public DateTime RefreshTokenExpiry { get; set; }
}
