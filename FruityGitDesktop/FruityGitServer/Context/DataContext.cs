namespace FruityGitServer.Context
{
    using FruityGitServer.Controllers;
    using Microsoft.EntityFrameworkCore;

    public class DataContext : DbContext
    {
        public DataContext(DbContextOptions<DataContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }
        public DbSet<Repository> Repositories { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // User configuration
            modelBuilder.Entity<User>(entity =>
            {
                entity.HasKey(u => u.Id);
                entity.Property(u => u.Id).ValueGeneratedOnAdd();
                entity.Property(u => u.Name).IsRequired().HasMaxLength(100);
                entity.Property(u => u.Email).IsRequired().HasMaxLength(255);
                entity.Property(u => u.Password).IsRequired();
                entity.HasIndex(u => u.Email).IsUnique();
            });

            // Repository configuration
            modelBuilder.Entity<Repository>(entity =>
            {
                entity.HasKey(r => r.Id);
                entity.Property(r => r.Id).ValueGeneratedOnAdd();
                entity.Property(r => r.Name).IsRequired().HasMaxLength(100);
                entity.Property(r => r.DirectoryPath).IsRequired();
                entity.Property(r => r.AuthorEmail).IsRequired().HasMaxLength(255);
                entity.Property(r => r.IsPrivate).IsRequired().HasDefaultValue(false);
                entity.Property(r => r.CreatedAt).IsRequired().HasDefaultValueSql("NOW()");
                
                // Set up foreign key relationship with User
                entity.HasOne(r => r.Author)
                      .WithMany(u => u.Repositories)
                      .HasForeignKey(r => r.AuthorEmail)
                      .HasPrincipalKey(u => u.Email)
                      .OnDelete(DeleteBehavior.Restrict);
                
                // Ensure repository names are unique
                entity.HasIndex(r => r.Name).IsUnique();
            });
        }

        public async Task<bool> TryInitializeAsync()
        {
            try
            {
                await Database.MigrateAsync();
                return await Database.CanConnectAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Migration failed: {ex}");
                return false;
            }
        }
    }

    public class User
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
        public string Password { get; set; } 
        public ICollection<Repository> Repositories { get; set; }
    }

    public class Repository
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string DirectoryPath { get; set; }
        public string AuthorEmail { get; set; }
        public bool IsPrivate { get; set; }
        public DateTime CreatedAt { get; set; }
        
        public User Author { get; set; }
    }
}