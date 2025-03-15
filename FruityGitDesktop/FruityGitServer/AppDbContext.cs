using FruityGitServer;
using Microsoft.EntityFrameworkCore;

public class AppDbContext : DbContext
{
    // Конструктор, принимающий DbContextOptions<AppDbContext>
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Message> Messages { get; set; }

    // Удалите метод OnConfiguring, так как конфигурация теперь передаётся через конструктор
}