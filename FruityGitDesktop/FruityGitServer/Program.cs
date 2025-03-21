using Microsoft.EntityFrameworkCore;
using FruityGitServer;
using System;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlite("Data Source=mydatabase.db");
});


builder.Services.AddControllers();
var app = builder.Build();

app.Use(async (context, next) =>
{
    var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();
    logger.LogInformation($"Входящий запрос: {context.Request.Method} {context.Request.Path}");
    try
    {
        await next();
    }
    catch (Exception ex)
    {
        if (app.Environment.IsDevelopment())
            logger.LogError($"Ошибка: {context.Request.Method} {context.Request.Path}: {ex.Message}");
    }
    finally
    {
        logger.LogInformation(
            $"Запрос выполнен: {context.Request.Method} {context.Request.Path} [{context.Response.StatusCode}] ");
    }
});

app.UseRouting();

app.UseAuthorization();

app.MapControllers();

app.Run();
