using Microsoft.EntityFrameworkCore;

namespace EntitiesLibrary.Services
{
    public class HasUserIdEntityService<TSource>(DbContext dataContext) : DataEntityService<TSource>(dataContext), IHasUserIdService<TSource> where TSource : IdentifiableEntity, IHasUserId
    {
        /// <summary>
        ///     Получить модели по списку идентификаторов.
        /// </summary>
        /// <param name="dbSet">Набор объектов <see cref="DbSet{TEntity}" />.</param>
        /// <param name="ids">Список идентификаторов.</param>
        /// <typeparam name="TSource">Тип модели.</typeparam>
        /// <returns>Список моделей.</returns>
        public async Task<List<TSource>> Get(DbSet<TSource> dbSet, string userId, List<int>? ids = null)
        {
            ids ??= [];
            if (ids.Count <= 0)
            {
                return await dbSet.Where(entity => entity.UserId == userId || entity.Id == 0).ToListAsync();
            }
            return await dbSet.Where(entity => entity.Id == 0 || (entity.UserId == userId && ids.Contains(entity.Id.GetValueOrDefault()))).ToListAsync();
        }
    }
}
