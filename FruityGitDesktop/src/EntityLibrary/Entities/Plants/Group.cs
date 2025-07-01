using EntitiesLibrary.Common;
using EntitiesLibrary.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System.ComponentModel.DataAnnotations.Schema;

namespace EntitiesLibrary.Plants
{
    [Index(nameof(UserId))]
    [Table(nameof(Group))]
    public class Group : CommonEntity, IHasUserId
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


        public const bool IsUserIdRequired = true;

        /// <summary>
        ///     Конфигурация модели <see cref="Group" />.
        /// </summary>
        /// <param name="configuration">Конфигурация базы данных.</param>
        public class Configuration(BaseConfiguration configuration) : Configuration<Group>(configuration)
        {
            /// <summary>
            ///     Задать конфигурацию для модели.
            /// </summary>
            /// <param name="builder">Набор интерфейсов настройки модели.</param>
            public override void Configure(EntityTypeBuilder<Group> builder)
            {
                builder.Property(group => group.UserId)
                    .IsRequired(IsUserIdRequired);
                builder.HasOne(g => g.User)
                    .WithMany()
                    .HasForeignKey(g => g.UserId)
                    .IsRequired();
                base.Configure(builder);
            }
        }

        #endregion


        public required string UserId { get; set; }
        public User? User { get; set; }
        public List<Plant> Plants { get; set; } = [];
    }
}
