using FruityGitServer.Context;
using FruityGitServer.Models;
using Microsoft.EntityFrameworkCore;

namespace FruityGitServer.Repositories;

public class RepositoryRepository : IRepositoryRepository
{
    private readonly DataContext _context;
    private readonly ILogger<RepositoryRepository> _logger;

    public RepositoryRepository(DataContext context, ILogger<RepositoryRepository> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<Repository?> GetByNameAsync(string name, string? userId = null)
    {
        var query = _context.Repositories.Where(r => r.Name == name);
        
        if (userId != null)
        {
            query = query.Where(r => r.AuthorId == userId);
        }

        return await query.FirstOrDefaultAsync();
    }

    public async Task<Repository?> GetByIdAsync(int id)
    {
        return await _context.Repositories.FindAsync(id);
    }

    public async Task<IEnumerable<Repository>> GetUserRepositoriesAsync(string userId)
    {
        return await _context.Repositories
            .Where(r => r.AuthorId == userId)
            .ToListAsync();
    }

    public async Task<IEnumerable<Repository>> GetPublicRepositoriesByEmailAsync(string email)
    {
        return await _context.Repositories
            .Where(r => r.AuthorEmail == email && !r.IsPrivate)
            .ToListAsync();
    }

    public async Task<Repository> CreateAsync(Repository repository)
    {
        _context.Repositories.Add(repository);
        await _context.SaveChangesAsync();
        return repository;
    }

    public async Task DeleteAsync(int id)
    {
        var repository = await _context.Repositories.FindAsync(id);
        if (repository != null)
        {
            _context.Repositories.Remove(repository);
            await _context.SaveChangesAsync();
        }
    }

    public async Task<bool> ExistsAsync(string name, string userId)
    {
        return await _context.Repositories
            .AnyAsync(r => r.Name == name && r.AuthorId == userId);
    }

    public async Task<bool> ExistsGloballyAsync(string name)
    {
        return await _context.Repositories
            .AnyAsync(r => r.Name == name);
    }
}

