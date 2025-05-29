using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using System.Text;
using FruityGitServer.Models;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using System.Security.Claims;
using System.Text.Json.Serialization;
using System.Text.Json;

namespace FruityGitServer.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly ILogger<AuthController> _logger;

        public AuthController(AppDbContext context, IConfiguration configuration, ILogger<AuthController> logger)
        {
            _context = context;
            _configuration = configuration;
            _logger = logger;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            try
            {
                _logger.LogInformation("Login attempt for user: {Email}", request?.Email ?? "null");

                if (request == null)
                {
                    _logger.LogWarning("Login request is null");
                    return BadRequest(new { error = "Invalid request format" });
                }

                if (!ModelState.IsValid)
                {
                    var errors = string.Join(", ", ModelState.Values
                        .SelectMany(v => v.Errors)
                        .Select(e => e.ErrorMessage));
                    _logger.LogWarning("Invalid login request for {Email}: {Errors}", 
                        request.Email, errors);
                    return BadRequest(new { error = "Invalid request: " + errors });
                }

                var user = await _context.Users
                    .FirstOrDefaultAsync(u => u.Email == request.Email);

                if (user == null)
                {
                    _logger.LogWarning("Login failed: User not found for email {Email}", request.Email);
                    return Unauthorized(new { error = "Invalid email or password" });
                }

                if (!BCrypt.Net.BCrypt.Verify(request.Password, user.Password))
                {
                    _logger.LogWarning("Login failed: Invalid password for user {Email}", request.Email);
                    return Unauthorized(new { error = "Invalid email or password" });
                }

                var token = GenerateJwtToken(user);
                _logger.LogInformation("Login successful for user {Email}", user.Email);

                var response = new LoginResponse
                {
                    AccessToken = token,
                    TokenType = "bearer",
                    ExpiresIn = 3600,
                    User = new UserInfo
                    {
                        Name = user.Name,
                        Email = user.Email
                    },
                    RedirectUrl = "/dashboard"
                };

                // Log the response for debugging
                var jsonResponse = JsonSerializer.Serialize(response);
                _logger.LogInformation("Sending response: {Response}", jsonResponse);

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error during login");
                return StatusCode(500, new { error = "An unexpected error occurred" });
            }
        }

        private string GenerateJwtToken(User user)
        {
            try
            {
                var key = Encoding.ASCII.GetBytes(_configuration["Jwt:Key"] ?? 
                    throw new InvalidOperationException("JWT key not configured"));
                var tokenHandler = new JwtSecurityTokenHandler();
                var tokenDescriptor = new SecurityTokenDescriptor
                {
                    Subject = new ClaimsIdentity(new[]
                    {
                        new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                        new Claim(ClaimTypes.Email, user.Email),
                        new Claim(ClaimTypes.Name, user.Name)
                    }),
                    Expires = DateTime.UtcNow.AddHours(1),
                    SigningCredentials = new SigningCredentials(
                        new SymmetricSecurityKey(key),
                        SecurityAlgorithms.HmacSha256Signature)
                };

                var token = tokenHandler.CreateToken(tokenDescriptor);
                _logger.LogInformation("JWT token generated for user {Email}", user.Email);
                return tokenHandler.WriteToken(token);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating JWT token for user {Email}", user.Email);
                throw;
            }
        }
    }

    public class LoginRequest
    {
        [JsonPropertyName("email")]
        public string Email { get; set; }

        [JsonPropertyName("password")]
        public string Password { get; set; }
    }

    public class LoginResponse
    {
        [JsonPropertyName("access_token")]
        public string AccessToken { get; set; }

        [JsonPropertyName("token_type")]
        public string TokenType { get; set; }

        [JsonPropertyName("expires_in")]
        public int ExpiresIn { get; set; }

        [JsonPropertyName("user")]
        public UserInfo User { get; set; }

        [JsonPropertyName("redirect_url")]
        public string RedirectUrl { get; set; }
    }

    public class UserInfo
    {
        [JsonPropertyName("name")]
        public string Name { get; set; }

        [JsonPropertyName("email")]
        public string Email { get; set; }
    }
} 