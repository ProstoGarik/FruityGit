using EntitiesLibrary.Data;
using EntitiesLibrary.Plants;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using System.ComponentModel.DataAnnotations.Schema;

namespace EntitiesLibrary.Common
{
    [Table(nameof(GrowStage))]
    public class GrowStage : CommonEntity
    {
        //None,
        //Seed,
        //Sprout,
        //Junior,
        //FruitBearer,
        //Aged

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
        ///     Конфигурация модели <see cref="GrowStage" />.
        /// </summary>
        /// <param name="configuration">Конфигурация базы данных.</param>
        public class Configuration(BaseConfiguration configuration) : Configuration<GrowStage>(configuration)
        {
            /// <summary>
            ///     Задать конфигурацию для модели.
            /// </summary>
            /// <param name="builder">Набор интерфейсов настройки модели.</param>
            public override void Configure(EntityTypeBuilder<GrowStage> builder)
            {
                base.Configure(builder);
            }
        }

        #endregion

        public List<Plant> Plants { get; set; } = [];
    }
}
