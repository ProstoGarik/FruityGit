using EntitiesLibrary.Data;
using EntitiesLibrary.Plants;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System.ComponentModel.DataAnnotations.Schema;

namespace EntitiesLibrary.Events
{
    [Index(nameof(UserId))]
    [Table(nameof(Event))]
    public class Event : IdentifiableEntity, IHasUserId
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
        public const bool IsUserIdRequired = true;
        public const bool IsTitleRequired = false;
        public const bool IsDateRequired = false;
        public const bool IsPlantIdRequired = true;

        /// <summary>
        ///     Конфигурация модели <see cref="Subject" />.
        /// </summary>
        /// <param name="configuration">Конфигурация базы данных.</param>
        public class Configuration(BaseConfiguration configuration) : Configuration<Event>(configuration)
        {
            /// <summary>
            ///     Задать конфигурацию для модели.
            /// </summary>
            /// <param name="builder">Набор интерфейсов настройки модели.</param>
            public override void Configure(EntityTypeBuilder<Event> builder)
            {
                builder.Property(ev => ev.UserId)
                    .IsRequired(IsUserIdRequired);
                builder.HasOne(ev => ev.Plant)
                    .WithMany()
                    .HasForeignKey(plant => plant.PlantId)
                    .IsRequired(IsPlantIdRequired);

                builder.Property(ev => ev.Title)
                   .HasMaxLength(TitleLengthMax)
                   .IsRequired(IsTitleRequired);

                builder.Property(ev => ev.Date)
                   .IsRequired(IsDateRequired);

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
        ///     Название уровня потребности растения в воде.
        /// </summary>
        public string? Title { get; set; }

        #endregion

        public required string UserId { get; set; }
        public required int PlantId { get; set; }

        public Plant? Plant { get; set; }
        public DateTime? Date { get; set; } = DateTime.MinValue;

        public List<Notification> Notifications { get; set; } = [];
    }
}
