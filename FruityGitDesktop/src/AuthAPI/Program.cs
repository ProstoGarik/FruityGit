using AuthAPI.Data;
using EntitiesLibrary;
using JwtAuthenticationManager;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Prometheus;
using Serilog;
using Serilog.Sinks.Grafana.Loki;


Log.Logger = new LoggerConfiguration()
    .WriteTo
    .GrafanaLoki("http://loki:3100")
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);
RegisterDataSources(builder.Services);
builder.Services.AddIdentity<User, IdentityRole>()
    .AddEntityFrameworkStores<DataContext>()
    .AddUserManager<UserManager<User>>()
    .AddRoleManager<RoleManager<IdentityRole>>()
    .AddSignInManager<SignInManager<User>>();

builder.Services.AddControllers();
var options = new JwtOptions();
var section = builder.Configuration.GetSection("jwt");
section.Bind(options);
builder.Services.AddSingleton(options);
builder.Services.AddSingleton<JwtTokenHandler>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddHealthChecks();




var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health");
app.MapControllers();

await InitializeDataSources(app);


app.UseMetricServer(url: "/metrics");
app.UseHttpMetrics();

app.Run();

void RegisterDataSources(IServiceCollection services)
{
    var dbHost = Environment.GetEnvironmentVariable("DB_HOST");
    var dbName = Environment.GetEnvironmentVariable("POSTGRES_DB");
    var dbUser = Environment.GetEnvironmentVariable("POSTGRES_USER");
    var dbPassword = Environment.GetEnvironmentVariable("POSTGRES_PASSWORD");
    var connectionString = $"Server={dbHost};Port=5432;Database={dbName};User Id={dbUser};Password={dbPassword};";
    builder.Services.AddDbContext<DataContext>(o => o.UseNpgsql(connectionString,x=>x.MigrationsHistoryTable("__AuthMigrationsHistory")));
}

async Task InitializeDataSources(WebApplication application)
{
    using var scope = application.Services.CreateScope();
    var dataContext = scope.ServiceProvider.GetRequiredService<DataContext>();
    await dataContext.TryInitializeAsync();
}