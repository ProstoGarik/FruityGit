using EntitiesLibrary.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EntitiesLibrary
{/// <summary>
///     Модель стандартного объекта с соответствующей
///     таблицей в базе данных.
/// </summary>
    public abstract class Entity
    {
        /*                   __ _                       _   _
         *   ___ ___  _ __  / _(_) __ _ _   _ _ __ __ _| |_(_) ___  _ __
         *  / __/ _ \| '_ \| |_| |/ _` | | | | '__/ _` | __| |/ _ \| '_ \
         * | (_| (_) | | | |  _| | (_| | |_| | | | (_| | |_| | (_) | | | |
         *  \___\___/|_| |_|_| |_|\__, |\__,_|_|  \__,_|\__|_|\___/|_| |_|
         *                        |___/
         * Константы, задающие базовые конфигурации полей
         * и ограничения модели.
         */

        #region Configuration

        private const bool IsCreatedAtRequired = false;
        private const bool IsUpdatedAtRequired = false;

        /// <summary>
        ///     Конфигурация модели <see cref="Entity" />.
        ///     Используется для дополнительной настройки,
        ///     включая биндинг полей под данные,
        ///     создание зависимостей и маппинг в базе данных.
        /// </summary>
        /// <param name="configuration">Конфигурация базы данных.</param>
        /// <typeparam name="T">
        ///     <see cref="Entity" />
        /// </typeparam>
        public abstract class Configuration<T>(BaseConfiguration configuration) : IEntityTypeConfiguration<T>
            where T : Entity
        {
            /// <summary>
            ///     Конфигурация базы данных.
            /// </summary>
            protected BaseConfiguration ContextConfiguration { get; } = configuration;

            /// <summary>
            ///     Задать конфигурацию для модели.
            /// </summary>
            /// <param name="builder">Набор интерфейсов настройки модели.</param>
            public virtual void Configure(EntityTypeBuilder<T> builder)
            {
                builder.Property(entity => entity.CreatedAt)
                    .HasColumnType(ContextConfiguration.DateTimeType)
                    .HasDefaultValueSql(ContextConfiguration.DateTimeValueCurrent)
                    .ValueGeneratedOnAddOrUpdate()
                    .IsRequired(IsCreatedAtRequired);

                builder.Property(entity => entity.UpdatedAt)
                    .HasColumnType(ContextConfiguration.DateTimeType)
                    .IsRequired(IsUpdatedAtRequired);
            }
        }

        #endregion

        /*             _   _ _
         *   ___ _ __ | |_(_) |_ _   _
         *  / _ \ '_ \| __| | __| | | |
         * |  __/ | | | |_| | |_| |_| |
         *  \___|_| |_|\__|_|\__|\__, |
         *                       |___/
         * Поля данных, соответствующие таковым в таблице
         * модели в базе данных.
         */

        #region Entity

        /// <summary>
        ///     Дата создания.
        /// </summary>
        public DateTime? CreatedAt { get; set; }

        /// <summary>
        ///     Дата обновления.
        /// </summary>
        public DateTime? UpdatedAt { get; set; }

        #endregion
    }
}
