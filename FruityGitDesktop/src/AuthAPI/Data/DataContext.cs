
using EntitiesLibrary;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace AuthAPI.Data;

public class DataContext : IdentityDbContext<User>
{
    public DataContext(DbContextOptions<DataContext> options)
        : base(options)
    {
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
