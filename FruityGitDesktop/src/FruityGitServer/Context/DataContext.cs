using FruityGitServer.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FruityGitServer.Context;

public class DataContext : IdentityDbContext<User>
{
    private readonly ILogger<DataContext> _logger;

    public DataContext(DbContextOptions<DataContext> options, ILogger<DataContext> logger) : base(options)
    {
        _logger = logger;
    }

    public DbSet<Repository> Repositories { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Repository>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.Property(r => r.Id).ValueGeneratedOnAdd();

            entity.Property(r => r.Name)
                  .IsRequired()
                  .HasMaxLength(100);

            entity.Property(r => r.DirectoryPath)
                  .IsRequired();

            entity.Property(r => r.AuthorId)
                  .IsRequired();

            entity.Property(r => r.IsPrivate)
                  .IsRequired()
                  .HasDefaultValue(false);

            entity.Property(r => r.CreatedAt)
                  .IsRequired()
                  .HasDefaultValueSql("NOW()");

            entity.HasOne(r => r.Author)
                  .WithMany()                    
                  .HasForeignKey(r => r.AuthorId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasIndex(r => new { r.Name, r.AuthorId })
                  .IsUnique();

            entity.HasIndex(r => r.AuthorId);
        });
    }

    public async Task<bool> InitializeAsync()
    {
        try
        {
            await Database.MigrateAsync();
            _logger.LogInformation("Database migrated successfully");
            return await Database.CanConnectAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Database initialization failed");
            return false;
        }
    }
}