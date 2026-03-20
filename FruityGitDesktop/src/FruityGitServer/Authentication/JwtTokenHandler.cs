using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Logging;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using FruityGitServer.Models;

namespace FruityGitServer.Authentication;

public class JwtTokenHandler
{
    private readonly JwtOptions _options;
    private readonly ILogger<JwtTokenHandler> _logger;


    public JwtTokenHandler(IOptions<JwtOptions> options, ILogger<JwtTokenHandler> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public string GenerateRefreshToken()
    {
        var randomNumber = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomNumber);
        return Convert.ToBase64String(randomNumber);
    }

    public string HashRefreshToken(string refreshToken)
    {
        using var sha256 = SHA256.Create();
        var hashBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(refreshToken));
        return Convert.ToBase64String(hashBytes);
    }

    public string GenerateJwtToken(User user, string role)
    {
        var tokenExpiryTimestamp = DateTime.UtcNow.AddMinutes(_options.ExpiryMinutes);
        var tokenKey = Encoding.ASCII.GetBytes(_options.Secret);

        var claims = new List<Claim>
    {
        new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        new(JwtRegisteredClaimNames.Iat, DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString()),
        new(ClaimTypes.NameIdentifier, user.Id),
        new(ClaimTypes.Role, role),
        new("name", user.UserName ?? string.Empty),
        new("email", user.Email ?? string.Empty)
    };

        var signingCredentials = new SigningCredentials(
            new SymmetricSecurityKey(tokenKey),
            SecurityAlgorithms.HmacSha256Signature);

        var securityTokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = tokenExpiryTimestamp,
            SigningCredentials = signingCredentials
        };

        var jwtSecurityTokenHandler = new JwtSecurityTokenHandler();
        var securityToken = jwtSecurityTokenHandler.CreateToken(securityTokenDescriptor);
        return jwtSecurityTokenHandler.WriteToken(securityToken);
    }

    public string? ValidateToken(string token)
    {
        try
        {
            var principal = GetPrincipal(token);
            if (principal?.Identity is not ClaimsIdentity identity)
            {
                _logger.LogWarning("ValidateToken: no principal or identity");
                return null;
            }

            var userIdClaim = identity.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier);
            if (userIdClaim == null)
            {
                _logger.LogWarning("ValidateToken: no NameIdentifier claim");
                return null;
            }
            _logger.LogInformation("ValidateToken: success for user {UserId}", userIdClaim.Value);
            return userIdClaim.Value;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "ValidateToken exception");
            return null;
        }
    }

    private ClaimsPrincipal? GetPrincipal(string token)
    {
        try
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            if (tokenHandler.ReadToken(token) is not JwtSecurityToken)
                return null;

            var parameters = new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                ValidateIssuer = false,
                ValidateAudience = false,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.ASCII.GetBytes(_options.Secret))
            };
            IdentityModelEventSource.ShowPII = true;
            return tokenHandler.ValidateToken(token, parameters, out _);
        }
        catch
        {
            return null;
        }
    }
}
