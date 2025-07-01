using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.Logging;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace JwtAuthenticationManager
{
    public class JwtTokenHandler(JwtOptions options)
    {
        private readonly JwtOptions _options = options;

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

        public string GenerateJwtToken(IdentityUser user, string role)
        {
            var tokenExpiryTimestamp = DateTime.Now.AddMinutes(_options.ExpiryMinutes);
            var tokenKey = Encoding.ASCII.GetBytes(_options.Secret);
            var claims = new ClaimsIdentity(new List<Claim>
            {
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
                new(JwtRegisteredClaimNames.Iat, DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString()),
                new(ClaimTypes.NameIdentifier, user.Id),
                new(ClaimTypes.Role, role)
            });

            var signingCredentials = new SigningCredentials(
                new SymmetricSecurityKey(tokenKey),
                SecurityAlgorithms.HmacSha256Signature);

            var securityTokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = claims,
                Expires = tokenExpiryTimestamp,
                SigningCredentials = signingCredentials
            };

            var jwtSecurityTokenHandler = new JwtSecurityTokenHandler();
            var securityToken = jwtSecurityTokenHandler.CreateToken(securityTokenDescriptor);
            var token = jwtSecurityTokenHandler.WriteToken(securityToken);
            return token;
        }

        public string ValidateToken(string token)
        {
            var principal = GetPrincipal(token);
            if (principal == null)
            {
                return string.Empty;
            }

            var identity = principal.Identity as ClaimsIdentity;
            if (identity == null)
            {
                return string.Empty;
            }


            var userIdClaim = identity.Claims.FirstOrDefault(claim => claim.Type == ClaimTypes.NameIdentifier);
            return userIdClaim?.Value ?? string.Empty;
        }

        private ClaimsPrincipal? GetPrincipal(string token)
        {
            try
            {
                var tokenHandler = new JwtSecurityTokenHandler();
                var jwtToken = (JwtSecurityToken)tokenHandler.ReadToken(token);
                if (jwtToken == null)
                {
                    return null;
                }
                var key = Encoding.UTF8.GetBytes(_options.Secret);
                var parameters = new TokenValidationParameters()
                {
                    ValidateIssuerSigningKey = true,
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.ASCII.GetBytes(_options.Secret))
                };
                IdentityModelEventSource.ShowPII = true;
                ClaimsPrincipal principal = tokenHandler.ValidateToken(token, parameters, out _);
                return principal;
            }
            catch (Exception)
            {
                return null;
            }
        }
    }
}
