namespace FruityGitServer.Context
{
    using FruityGitServer.Controllers;
    using Microsoft.EntityFrameworkCore;

    public class DataContext : DbContext
    {
        public DataContext(DbContextOptions<DataContext> options) : base(options) { }

        public DbSet<User> Users { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<User>(entity =>
            {
                entity.HasKey(u => u.Id);
                entity.Property(u => u.Id).ValueGeneratedOnAdd();
                entity.Property(u => u.Name).IsRequired().HasMaxLength(100);
                entity.Property(u => u.Email).IsRequired().HasMaxLength(255);
                entity.Property(u => u.Password).IsRequired();
                entity.HasIndex(u => u.Email).IsUnique();
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
    }
}
