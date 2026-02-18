using FruityGitServer.Context;
using FruityGitServer.Middleware;
using FruityGitServer.Repositories;
using FruityGitServer.Services;
using Microsoft.EntityFrameworkCore;
using Serilog;
using Serilog.Sinks.Grafana.Loki;
using System.Collections.Generic;

Log.Logger = new LoggerConfiguration()
    .Enrich.FromLogContext()
    .Enrich.WithProperty("app", Environment.GetEnvironmentVariable("APP_NAME"))
    .WriteTo.GrafanaLoki(
        "http://loki:3100",
        labels: new List<LokiLabel> { new LokiLabel { Key = "app", Value = Environment.GetEnvironmentVariable("APP_NAME") } }
    )
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
RegisterDataSources(builder.Services);
RegisterApplicationServices(builder.Services);

var app = builder.Build();

await InitializeDataSources(app);

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

// Global exception handler must be first
app.UseMiddleware<GlobalExceptionHandler>();

app.UseRouting();

// Fix middleware order: Authentication before Authorization
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

void RegisterDataSources(IServiceCollection services)
{
    var dbHost = Environment.GetEnvironmentVariable("DB_HOST") ?? "postgres";
    var dbName = Environment.GetEnvironmentVariable("POSTGRES_DB") ?? "FruityDB";
    var dbUser = Environment.GetEnvironmentVariable("POSTGRES_USER") ?? "postgres";
    var dbPassword = Environment.GetEnvironmentVariable("POSTGRES_PASSWORD") ?? "123Secret";

    var connectionString = $"Host={dbHost};Database={dbName};Username={dbUser};Password={dbPassword}";

    // Removed Console.WriteLine for security - connection string should not be logged
    services.AddDbContext<DataContext>(options =>
        options.UseNpgsql(connectionString));
}

void RegisterApplicationServices(IServiceCollection services)
{
    // Register repositories
    services.AddScoped<IRepositoryRepository, RepositoryRepository>();
    
    // Register services
    services.AddScoped<IGitService, GitService>();
}

async Task InitializeDataSources(WebApplication application)
{
    using var scope = application.Services.CreateScope();
    var dataContext = scope.ServiceProvider.GetRequiredService<DataContext>();
    await dataContext.InitializeAsync();
}