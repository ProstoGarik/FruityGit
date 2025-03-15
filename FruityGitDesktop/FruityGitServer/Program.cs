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

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();
