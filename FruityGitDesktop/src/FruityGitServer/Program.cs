using FruityGitServer.Authentication;
using FruityGitServer.Context;
using FruityGitServer.Middleware;
using FruityGitServer.Models;
using FruityGitServer.Repositories;
using FruityGitServer.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Serilog;
using Serilog.Sinks.Grafana.Loki;
using System.Collections.Generic;

var loggerConfig = new LoggerConfiguration()
    .Enrich.FromLogContext()
    .Enrich.WithProperty("app", Environment.GetEnvironmentVariable("APP_NAME") ?? "FruityGitServer")
    .WriteTo.Console();
var lokiUrl = Environment.GetEnvironmentVariable("LOKI_URL");
if (!string.IsNullOrEmpty(lokiUrl))
{
    loggerConfig = loggerConfig.WriteTo.GrafanaLoki(lokiUrl,
        labels: new List<LokiLabel> { new LokiLabel { Key = "app", Value = Environment.GetEnvironmentVariable("APP_NAME") ?? "fruitygit" } });
}
Log.Logger = loggerConfig.CreateLogger();

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
RegisterDataSources(builder.Services);
RegisterApplicationServices(builder.Services);

// Identity
builder.Services.AddIdentity<User, IdentityRole>()
    .AddEntityFrameworkStores<DataContext>()
    .AddDefaultTokenProviders();

// JWT
builder.Services.AddJwtAuthentication(builder.Configuration);
builder.Services.AddSingleton<JwtTokenHandler>();

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Swagger & Health
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHealthChecks();

var app = builder.Build();

await InitializeDataSources(app);

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<GlobalExceptionHandler>();
app.UseRouting();
app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<GiteaProxyMiddleware>();

app.MapHealthChecks("/health");
app.MapControllers();

app.Run();

void RegisterDataSources(IServiceCollection services)
{
    var dbHost = Environment.GetEnvironmentVariable("DB_HOST") ?? "localhost";
    var dbName = Environment.GetEnvironmentVariable("POSTGRES_DB") ?? "FruityDB";
    var dbUser = Environment.GetEnvironmentVariable("POSTGRES_USER") ?? "postgres";
    var dbPassword = Environment.GetEnvironmentVariable("POSTGRES_PASSWORD") ?? "123Secret";
    var connectionString = $"Host={dbHost};Database={dbName};Username={dbUser};Password={dbPassword}";

    services.AddDbContext<DataContext>(options =>
        options.UseNpgsql(connectionString));
}

void RegisterApplicationServices(IServiceCollection services)
{
    services.AddScoped<IRepositoryRepository, RepositoryRepository>();
    services.AddScoped<IGitService, GitService>();
    services.AddHttpClient<GiteaService>();
    services.AddHttpClient();
}

async Task InitializeDataSources(WebApplication application)
{
    using var scope = application.Services.CreateScope();
    var dataContext = scope.ServiceProvider.GetRequiredService<DataContext>();
    await dataContext.InitializeAsync();
}
