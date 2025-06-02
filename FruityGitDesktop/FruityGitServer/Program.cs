using Microsoft.EntityFrameworkCore;
using FruityGitServer;
using System;
using Prometheus;
using Serilog;
using Serilog.Sinks.Grafana.Loki;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.EntityFrameworkCore.Storage;
using Database.Context;
using FruityGitServer.Context;


Log.Logger = new LoggerConfiguration()
    .Enrich.FromLogContext()
    .Enrich.WithProperty("app", Environment.GetEnvironmentVariable("APP_NAME"))
    .WriteTo.GrafanaLoki(
        "http://loki:3100",
        labels: new List<LokiLabel> { new LokiLabel { Key = "app", Value = Environment.GetEnvironmentVariable("APP_NAME") } }
    )
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddAuthorization();
RegisterDataSources(builder.Services);

var app = builder.Build();

await InitializeDataSources(app);

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}

app.Use(async (context, next) =>
{
    var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
    logger.LogInformation($"Incoming request: {context.Request.Method} {context.Request.Path}");
    try
    {
        await next();
    }
    catch (Exception ex)
    {
        if (app.Environment.IsDevelopment())
            logger.LogError($"Error: {context.Request.Method} {context.Request.Path}: {ex.Message}");
        throw; // Re-throw the exception to ensure proper error handling
    }
    finally
    {
        logger.LogInformation(
            $"Request complete: {context.Request.Method} {context.Request.Path} [{context.Response.StatusCode}] ");
    }
});

void RegisterDataSources(IServiceCollection services)
{
    var dbHost = Environment.GetEnvironmentVariable("DB_HOST") ?? "localhost";
    var dbName = Environment.GetEnvironmentVariable("POSTGRES_DB") ?? "FruityDB";
    var dbUser = Environment.GetEnvironmentVariable("POSTGRES_USER") ?? "postgres";
    var dbPassword = Environment.GetEnvironmentVariable("POSTGRES_PASSWORD") ?? "yoursecurepassword";

    var connectionString = $"Host={dbHost};Database={dbName};Username={dbUser};Password={dbPassword}";

    services.AddDbContext<DataContext>(options =>
        options.UseNpgsql(connectionString));
}

async Task InitializeDataSources(WebApplication application)
{
    using var scope = application.Services.CreateScope();
    var dataContext = scope.ServiceProvider.GetRequiredService<DataContext>();
    await dataContext.TryInitializeAsync();
}


    app.UseRouting();

app.MapControllers();

app.Run();
