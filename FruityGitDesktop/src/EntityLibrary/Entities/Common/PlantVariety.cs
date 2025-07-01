using EntitiesLibrary.Data;
using EntitiesLibrary.Plants;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System.ComponentModel.DataAnnotations.Schema;

namespace EntitiesLibrary.Common
{
    [Table(nameof(PlantVariety))]
    public class PlantVariety : CommonEntity
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


        /// <summary>
        ///     Конфигурация модели <see cref="PlantVariety" />.
        /// </summary>
        /// <param name="configuration">Конфигурация базы данных.</param>
        public class Configuration(BaseConfiguration configuration) : Configuration<PlantVariety>(configuration)
        {
            /// <summary>
            ///     Задать конфигурацию для модели.
            /// </summary>
            /// <param name="builder">Набор интерфейсов настройки модели.</param>
            public override void Configure(EntityTypeBuilder<PlantVariety> builder)
            {
                base.Configure(builder);
                builder.HasOne(x=>x.PlantType)
                    .WithMany(type=>type.PlantVarieties)
                    .HasForeignKey(x=>x.PlantTypeId);
            }
        }

        #endregion
        public int? PlantTypeId { get; set; }
        public PlantType? PlantType { get; set; }
        public List<Plant> Plants { get; set; } = [];
    }
}