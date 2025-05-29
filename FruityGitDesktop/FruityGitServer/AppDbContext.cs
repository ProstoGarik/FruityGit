using FruityGitServer;
using FruityGitServer.Models;
using Microsoft.EntityFrameworkCore;

public class AppDbContext : DbContext
{
    // Конструктор, принимающий DbContextOptions<AppDbContext>
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Message> Messages { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<GitRepository> Repositories { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<GitRepository>()
            .HasOne(r => r.User)
            .WithMany()
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }

    // Удалите метод OnConfiguring, так как конфигурация теперь передаётся через конструктор
}