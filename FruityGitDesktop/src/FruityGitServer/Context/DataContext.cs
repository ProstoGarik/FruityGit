// In DataContext.cs
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

public class DataContext : IdentityDbContext<ApplicationUser>
{
    private readonly ILogger<DataContext> _logger;

    public DataContext(DbContextOptions<DataContext> options, ILogger<DataContext> logger) : base(options)
    {
        _logger = logger;
    }
    
    
    public DbSet<Repository> Repositories { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        modelBuilder.Entity<Repository>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.Property(r => r.Id).ValueGeneratedOnAdd();
            entity.Property(r => r.Name).IsRequired().HasMaxLength(100);
            entity.Property(r => r.DirectoryPath).IsRequired();
            entity.Property(r => r.AuthorId).IsRequired(); // Changed to AuthorId
            entity.Property(r => r.IsPrivate).IsRequired().HasDefaultValue(false);
            entity.Property(r => r.CreatedAt).IsRequired().HasDefaultValueSql("NOW()");
            
            // Relationship with Identity User
            entity.HasOne<ApplicationUser>()
                  .WithMany(u => u.Repositories)
                  .HasForeignKey(r => r.AuthorId)
                  .HasPrincipalKey(u => u.Id)
                  .OnDelete(DeleteBehavior.Restrict);
            
            entity.HasIndex(r => r.Name).IsUnique();
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

// ApplicationUser.cs
public class ApplicationUser : IdentityUser
{
    public ICollection<Repository> Repositories { get; set; }
}

// Repository.cs
public class Repository
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string DirectoryPath { get; set; }
    public string AuthorId { get; set; } // Changed to string to match IdentityUser.Id
    public bool IsPrivate { get; set; }
    public DateTime CreatedAt { get; set; }
    
    public ApplicationUser Author { get; set; }
}