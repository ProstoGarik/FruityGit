using EntitiesLibrary;
using Microsoft.EntityFrameworkCore;
namespace EntitiesLibrary.Services
{
    /// <summary>
    ///     Сервис для работы с моделями.
    /// </summary>
    /// <param name="dataContext">Контекст данных.</param>
    public class DataEntityService<TSource>(DbContext dataContext) : IDataEntityService<TSource> where TSource : IdentifiableEntity
    {
        /// <summary>
        ///    Контекст данных.
        /// </summary>
        public DbContext DataContext { get; } = dataContext;

        /// <summary>
        ///     Получить модели по списку идентификаторов.
        /// </summary>
        /// <param name="dbSet">Набор объектов <see cref="DbSet{TEntity}" />.</param>
        /// <param name="ids">Список идентификаторов.</param>
        /// <typeparam name="TSource">Тип модели.</typeparam>
        /// <returns>Список моделей.</returns>
        public async Task<IEnumerable<TSource>> Get(DbSet<TSource> dbSet, List<int> ids)
        {
            if (ids.Count <= 0)
            {
                return await dbSet.ToListAsync();
            }

            return await dbSet.Where(entity => ids.Contains(entity.Id.GetValueOrDefault())).ToListAsync();
        }

        /// <summary>
        ///     Сохранить модели.
        /// </summary>
        /// <param name="dbSet">Набор объектов <see cref="DbSet{TEntity}" />.</param>
        /// <param name="entities">Список моделей.</param>
        /// <typeparam name="TSource">Тип модели.</typeparam>
        /// <returns>Статус операции.</returns>
        public async Task<bool> Set(DbSet<TSource> dbSet, List<TSource> entities)
        {
            if (entities.Count <= 0)
            {
                return false;
            }

            var newEntities = entities.Where(entity => !entity.Id.HasValue).ToList();
            var oldEntities = entities.Where(entity => entity.Id.HasValue).ToList();

            var oldIds = oldEntities.Select(entity => entity.Id.GetValueOrDefault()).ToList();
            var oldIdsInDb = await dbSet
                .Where(entity => oldIds.Contains(entity.Id.GetValueOrDefault()))
                .Select(entity => entity.Id.GetValueOrDefault())
                .ToListAsync();
            var oldIdsNotInDb = oldIds.Except(oldIdsInDb).ToList();

            newEntities.AddRange(oldEntities.Where(entity => oldIdsNotInDb.Contains(entity.Id.GetValueOrDefault())));
            oldEntities.RemoveAll(entity => oldIdsNotInDb.Contains(entity.Id.GetValueOrDefault()));

            DetachTrackedEntities(oldEntities);

            if (newEntities.Count > 0)
            {
                dbSet.AddRange(newEntities);
            }

            if (oldEntities.Count > 0)
            {
                dbSet.UpdateRange(oldEntities);
            }

            return await DataContext.SaveChangesAsync() > 0;
        }

        /// <summary>
        ///     Удалить модели.
        /// </summary>
        /// <param name="dbSet">Набор объектов <see cref="DbSet{TEntity}" />.</param>
        /// <param name="ids">Список идентификаторов.</param>
        /// <typeparam name="TSource">Тип модели.</typeparam>
        /// <returns>Статус операции.</returns>
        public async Task<bool> Remove(DbSet<TSource> dbSet, List<int> ids)
        {
            if (ids.Count <= 0)
            {
                return false;
            }

            dbSet.RemoveRange(dbSet.Where(entity => ids.Contains(entity.Id.GetValueOrDefault())));

            return await DataContext.SaveChangesAsync() > 0;
        }

        /// <summary>
        ///     Остановить отслеживание для указанных моделей.
        /// </summary>
        /// <typeparam name="TSource">Тип модели.</typeparam>
        /// <param name="entities">Список моделей.</param>
        private void DetachTrackedEntities(List<TSource> entities)
        {
            var entityIds = entities.Select(entity => entity.Id.GetValueOrDefault()).ToList();

            foreach (var entityId in entityIds)
            {
                var entry = DataContext.ChangeTracker
                    .Entries<TSource>()
                    .FirstOrDefault(entry => entry.Entity.Id == entityId);

                if (entry is not null)
                {
                    DataContext.Entry(entry.Entity).State = EntityState.Detached;
                }
            }
        }

    }
}
