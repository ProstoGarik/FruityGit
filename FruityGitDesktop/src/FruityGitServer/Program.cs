using Microsoft.EntityFrameworkCore;
using Serilog;
using Serilog.Sinks.Grafana.Loki;
using System.Collections.Generic;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

Log.Logger = new LoggerConfiguration()
    .Enrich.FromLogContext()
    .Enrich.WithProperty("app", Environment.GetEnvironmentVariable("APP_NAME"))
    .WriteTo.GrafanaLoki(
        "http://loki:3100",
        labels: new List<LokiLabel> { new LokiLabel { Key = "app", Value = Environment.GetEnvironmentVariable("APP_NAME") } }
    )
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);

var jwtOptions = new JwtOptions();
builder.Configuration.GetSection("jwt").Bind(jwtOptions);
builder.Services.AddSingleton(jwtOptions);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtOptions.Issuer,
        ValidAudience = jwtOptions.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SecretKey))
    };
});

// Add Identity and UserManager
builder.Services.AddIdentityCore<User>()
    .AddEntityFrameworkStores<DataContext>()
    .AddUserManager<UserManager<User>>();

// Add services to the container.
builder.Services.AddControllers();
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
        throw;
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

void RegisterDataSources(IServiceCollection services)
{
    var dbHost = Environment.GetEnvironmentVariable("DB_HOST") ?? "postgres";
    var dbName = Environment.GetEnvironmentVariable("POSTGRES_DB") ?? "FruityDB";
    var dbUser = Environment.GetEnvironmentVariable("POSTGRES_USER") ?? "postgres";
    var dbPassword = Environment.GetEnvironmentVariable("POSTGRES_PASSWORD") ?? "123Secret";

    var connectionString = $"Host={dbHost};Database={dbName};Username={dbUser};Password={dbPassword}";

    Console.WriteLine(connectionString);

    services.AddDbContext<DataContext>(options =>
        options.UseNpgsql(connectionString));
}

async Task InitializeDataSources(WebApplication application)
{
    using var scope = application.Services.CreateScope();
    var dataContext = scope.ServiceProvider.GetRequiredService<DataContext>();
    await dataContext.InitializeAsync();
}