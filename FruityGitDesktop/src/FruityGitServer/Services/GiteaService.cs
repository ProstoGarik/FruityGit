using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace FruityGitServer.Services;

public class GiteaService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<GiteaService> _logger;
    private readonly string _giteaBaseUrl;
    private readonly string _adminToken;

    public GiteaService(HttpClient httpClient, IConfiguration configuration, ILogger<GiteaService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _giteaBaseUrl = configuration["Gitea:BaseUrl"] ?? "http://gitea:3001";
        _adminToken = configuration["Gitea:AdminToken"] ?? throw new InvalidOperationException("Gitea:AdminToken is not configured");
    }

    public async Task<bool> UserExistsAsync(string username)
    {
        try
        {
            var request = new HttpRequestMessage(HttpMethod.Get, $"{_giteaBaseUrl}/api/v1/users/{username}");
            request.Headers.Authorization = new AuthenticationHeaderValue("token", _adminToken);
            var response = await _httpClient.SendAsync(request);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking if user exists in Gitea: {Username}", username);
            return false;
        }
    }

    public async Task<bool> CreateUserAsync(string username, string email, string? password = null)
    {
        try
        {
            if (await UserExistsAsync(username))
            {
                _logger.LogInformation("User {Username} already exists in Gitea", username);
                return true;
            }

            var userPassword = string.IsNullOrWhiteSpace(password) ? GenerateRandomPassword() : password;
            var createUser = new
            {
                username,
                email,
                password = userPassword,
                // API flow needs immediate token creation; forcing password change blocks API auth.
                must_change_password = false
            };
            var content = new StringContent(JsonSerializer.Serialize(createUser), Encoding.UTF8, "application/json");
            // Create user via Gitea admin API
            // Correct endpoint: POST /api/v1/admin/users
            var request = new HttpRequestMessage(HttpMethod.Post, $"{_giteaBaseUrl}/api/v1/admin/users")
            {
                Content = content
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("token", _adminToken);
            var response = await _httpClient.SendAsync(request);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Created user {Username} in Gitea", username);
                return true;
            }
            else
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogError("Failed to create user in Gitea: {StatusCode} - {Error}", response.StatusCode, error);
                return false;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating user in Gitea: {Username}", username);
            return false;
        }
    }

    public async Task<string?> CreateUserTokenAsync(string username, string? userPassword = null)
    {
        try
        {
            var tokenRequest = new
            {
                name = $"app-token-{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}",
                // Newer Gitea versions require at least one scope.
                // Include user write scope as /api/v1/user/* endpoints can enforce it.
                scopes = new[] { "read:repository", "write:repository", "read:user", "write:user" }
            };
            var content = new StringContent(JsonSerializer.Serialize(tokenRequest), Encoding.UTF8, "application/json");

            var request = new HttpRequestMessage(HttpMethod.Post, $"{_giteaBaseUrl}/api/v1/users/{username}/tokens")
            {
                Content = content
            };

            // This endpoint requires basic or reverse-proxy auth in many Gitea versions.
            // Prefer user basic auth when password is available.
            if (!string.IsNullOrWhiteSpace(userPassword))
            {
                var basicAuth = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{username}:{userPassword}"));
                request.Headers.Authorization = new AuthenticationHeaderValue("Basic", basicAuth);
            }
            else
            {
                request.Headers.Authorization = new AuthenticationHeaderValue("token", _adminToken);
                request.Headers.Add("X-Gitea-Sudo", username);
            }

            var response = await _httpClient.SendAsync(request);

            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync();
                using var doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("sha1", out var tokenElement))
                {
                    var token = tokenElement.GetString();
                    _logger.LogInformation("Created token for user {Username}", username);
                    return token;
                }
                _logger.LogWarning("Token response missing 'sha1' field for user {Username}", username);
                return null;
            }
            else
            {
                var error = await response.Content.ReadAsStringAsync();
                _logger.LogError("Failed to create token for user {Username}: {StatusCode} - {Error}", username, response.StatusCode, error);
                return null;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating token for user in Gitea: {Username}", username);
            return null;
        }
    }

    private string GenerateRandomPassword()
    {
        using var rng = RandomNumberGenerator.Create();
        var bytes = new byte[16];
        rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes) + "!Aa1";
    }
}