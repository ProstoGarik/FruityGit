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


Log.Logger = new LoggerConfiguration()
    .Enrich.FromLogContext()
    .Enrich.WithProperty("app", Environment.GetEnvironmentVariable("APP_NAME"))
    .WriteTo.GrafanaLoki(
        "http://loki:3100",
        labels: new List<LokiLabel> { new LokiLabel { Key = "app", Value = Environment.GetEnvironmentVariable("APP_NAME") } }
    )
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);

var dbPath = Path.Combine("..", "Service", "Database", "FruityDB.db");
var connectionString = $"Data Source={dbPath}";

builder.Services.AddDbContext<Database.Context.AppDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("Default")));

var app = builder.Build();

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

app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
