using Microsoft.EntityFrameworkCore;

namespace EntitiesLibrary.Services
{
    public interface IHasUserIdService<TSource> : IDataEntityService<TSource> where TSource : IdentifiableEntity
    {
        public Task<List<TSource>> Get(DbSet<TSource> dbSet, string userId, List<int>? ids = null);
    }
}
