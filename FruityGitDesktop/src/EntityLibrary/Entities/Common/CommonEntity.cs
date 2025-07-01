using EntitiesLibrary.Data;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EntitiesLibrary.Common
{
    public abstract class CommonEntity : IdentifiableEntity
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

        public const int TitleLengthMax = 256;
        public const bool IsTitleRequired = false;

        /// <summary>
        ///     Конфигурация модели <see cref="CommonEntity" />.
        ///     Используется для дополнительной настройки,
        ///     включая биндинг полей под данные,
        ///     создание зависимостей и маппинг в базе данных.
        /// </summary>
        /// <param name="configuration">Конфигурация базы данных.</param>
        /// <typeparam name="T">
        ///     <see cref="CommonEntity" />
        /// </typeparam>
        public new class Configuration<T>(BaseConfiguration configuration) : Entity.Configuration<T>(configuration)
            where T : CommonEntity
        {
            /// <summary>
            ///     Задать конфигурацию для модели.
            /// </summary>
            /// <param name="builder">Набор интерфейсов настройки модели.</param>
            public override void Configure(EntityTypeBuilder<T> builder)
            {
                builder.Property(common => common.Title)
                    .HasMaxLength(TitleLengthMax)
                    .IsRequired(IsTitleRequired);
                base.Configure(builder);
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
        ///     Название роста растения.
        /// </summary>
        public string? Title { get; set; }

        #endregion

    }
}
