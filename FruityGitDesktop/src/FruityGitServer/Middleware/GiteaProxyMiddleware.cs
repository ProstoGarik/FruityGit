using System.Net.Http.Headers;
using System.Security.Claims;

namespace FruityGitServer.Middleware;

public class GiteaProxyMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<GiteaProxyMiddleware> _logger;
    private readonly string _giteaBaseUrl;

    public GiteaProxyMiddleware(
        RequestDelegate next,
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        ILogger<GiteaProxyMiddleware> logger)
    {
        _next = next;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        // Адрес Gitea внутри Docker-сети (имя сервиса из docker-compose)
        _giteaBaseUrl = configuration["Gitea:BaseUrl"] ?? "http://gitea:3001";
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Проверяем, что путь начинается с /gitea/
        if (context.Request.Path.StartsWithSegments("/gitea", out var remainingPath))
        {
            // Извлекаем логин и email из claims пользователя, если он аутентифицирован
            string? username = null;
            string? email = null;

            if (context.User.Identity?.IsAuthenticated == true)
            {
                _logger.LogInformation("All claims:");
                foreach (var claim in context.User.Claims)
                {
                    _logger.LogInformation("  Claim: Type = {Type}, Value = {Value}", claim.Type, claim.Value);
                }
                username = context.User.FindFirst("name")?.Value ?? context.User.Identity.Name;
                // Try both "email" and the standard ClaimTypes.Email
                email = context.User.FindFirst("email")?.Value
                        ?? context.User.FindFirst(ClaimTypes.Email)?.Value;
                if (!string.IsNullOrEmpty(username) && string.IsNullOrEmpty(email))
                {
                    email = $"{username}@localhost.local"; // Gitea can generate a valid email from this
                }

            }


            // Строим целевой URL для Gitea, убирая префикс /gitea
            var targetUrl = _giteaBaseUrl + remainingPath + context.Request.QueryString;
            _logger.LogDebug("Target URL: {TargetUrl}", targetUrl);

            using var httpClient = _httpClientFactory.CreateClient();
            var requestMessage = new HttpRequestMessage
            {
                Method = new HttpMethod(context.Request.Method),
                RequestUri = new Uri(targetUrl),
                Content = new StreamContent(context.Request.Body) // всегда создаём StreamContent
            };
            var remoteIp = context.Connection.RemoteIpAddress?.ToString();
            if (!string.IsNullOrEmpty(remoteIp))
            {
                requestMessage.Headers.Add("X-Forwarded-For", remoteIp);
            }

            // Check if this is an API call (Gitea API endpoints can use reverse proxy auth too)
            var isApiCall = remainingPath.Value?.StartsWith("/api/", StringComparison.OrdinalIgnoreCase) == true;
            
            // Extract Gitea authentication token from custom headers (if present)
            // These are fallback options if reverse proxy auth doesn't work
            string? giteaToken = null;
            string? giteaBasicAuth = null;
            if (isApiCall)
            {
                if (context.Request.Headers.TryGetValue("X-Gitea-Token", out var tokenHeader))
                {
                    giteaToken = tokenHeader.ToString();
                }
                if (context.Request.Headers.TryGetValue("X-Gitea-Basic-Auth", out var basicHeader))
                {
                    giteaBasicAuth = basicHeader.ToString();
                }
            }
            
            // Копируем заголовки, исключая Host и кастомные Gitea заголовки
            // For API calls with authenticated user, we'll use reverse proxy headers (X-Remote-User)
            // For API calls without user, we'll try token/basic auth as fallback
            foreach (var header in context.Request.Headers)
            {
                if (header.Key.Equals("Host", StringComparison.OrdinalIgnoreCase) ||
                    header.Key.Equals("X-Gitea-Token", StringComparison.OrdinalIgnoreCase) ||
                    header.Key.Equals("X-Gitea-Basic-Auth", StringComparison.OrdinalIgnoreCase))
                    continue;
                
                // Skip ASP.NET Authorization header - we'll use reverse proxy headers or Gitea auth
                if (header.Key.Equals("Authorization", StringComparison.OrdinalIgnoreCase))
                    continue;

                if (!requestMessage.Headers.TryAddWithoutValidation(header.Key, header.Value.ToArray()))
                {
                    requestMessage.Content?.Headers.TryAddWithoutValidation(header.Key, header.Value.ToArray());
                }
            }

            // Add reverse proxy authentication headers if user is authenticated
            // This works for BOTH web UI and API calls when ENABLE_REVERSE_PROXY_AUTHENTICATION is enabled
            if (!string.IsNullOrEmpty(username))
            {
                requestMessage.Headers.Add("X-Remote-User", username);
                if (!string.IsNullOrEmpty(email))
                    requestMessage.Headers.Add("X-Remote-Email", email);
                
                _logger.LogInformation("Proxying request for user {Username} with email {Email}, Remote IP: {RemoteIp}, IsApiCall: {IsApiCall}, Using reverse proxy auth", 
                    username, email, context.Connection.RemoteIpAddress, isApiCall);
            }
            else
            {
                _logger.LogWarning("Proxying request without authenticated user, IsApiCall: {IsApiCall}", isApiCall);
                
                // Fallback: If no authenticated user, try token/basic auth for API calls
                if (isApiCall)
                {
                    if (!string.IsNullOrEmpty(giteaBasicAuth))
                    {
                        requestMessage.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", giteaBasicAuth);
                        _logger.LogInformation("Using Basic auth fallback for API call");
                    }
                    else if (!string.IsNullOrEmpty(giteaToken))
                    {
                        requestMessage.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("token", giteaToken);
                        _logger.LogInformation("Using token auth fallback for API call");
                    }
                }
            }

            // Отправляем запрос в Gitea
            HttpResponseMessage responseMessage;
            try
            {
                responseMessage = await httpClient.SendAsync(requestMessage, HttpCompletionOption.ResponseHeadersRead, context.RequestAborted);

                _logger.LogInformation("Gitea responded with status {StatusCode}", responseMessage.StatusCode);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error proxying request to Gitea");
                context.Response.StatusCode = StatusCodes.Status502BadGateway;
                await context.Response.WriteAsync("Gitea unreachable");
                return;
            }

            // Копируем статус и заголовки ответа
            context.Response.StatusCode = (int)responseMessage.StatusCode;
            foreach (var header in responseMessage.Headers)
            {
                // Пропускаем CORS-заголовки, т.к. их добавляет UseCors
                if (header.Key.StartsWith("Access-Control-", StringComparison.OrdinalIgnoreCase))
                    continue;
                context.Response.Headers[header.Key] = header.Value.ToArray();
            }
            foreach (var header in responseMessage.Content.Headers)
            {
                context.Response.Headers[header.Key] = header.Value.ToArray();
            }
            context.Response.Headers.Remove("transfer-encoding");

            // Копируем тело ответа
            await responseMessage.Content.CopyToAsync(context.Response.Body);
            return;
        }

        await _next(context);
    }
}