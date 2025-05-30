using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Database.Context
{
    public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
    {
        public AppDbContext CreateDbContext(string[] args)
        {
            var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
            optionsBuilder.UseSqlite("Data Source=Z:/GitHubFiles/MyRepos/SignalRHuBLocal/FruityGit/FruityGitDesktop/Service/Database/FruityDB.db");

            return new AppDbContext(optionsBuilder.Options);
        }
    }
}