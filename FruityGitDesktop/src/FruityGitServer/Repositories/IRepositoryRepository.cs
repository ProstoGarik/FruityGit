using FruityGitServer.Models;

namespace FruityGitServer.Repositories;

public interface IRepositoryRepository
{
    Task<Repository?> GetByNameAsync(string name, string? userId = null);
    Task<IEnumerable<Repository>> GetAllPublicRepositoriesAsync();
    Task<Repository?> GetByIdAsync(int id);
    Task<IEnumerable<Repository>> GetUserRepositoriesAsync(string userId);
    Task<IEnumerable<Repository>> GetPublicRepositoriesByEmailAsync(string email);
    Task<Repository> CreateAsync(Repository repository);
    Task DeleteAsync(int id);
    Task<bool> ExistsAsync(string name, string userId);
    Task<bool> ExistsGloballyAsync(string name);
}

