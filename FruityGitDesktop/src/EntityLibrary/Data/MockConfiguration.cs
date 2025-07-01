using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace EntitiesLibrary.Data
{
    public class MockConfiguration : BaseConfiguration
    {

        /// <summary>
        ///     Тип полей даты и времени в базе данных.
        /// </summary>
        internal override string DateTimeType => "timestamp with time zone";

        /// <summary>
        ///     Указатель использования текущих даты и времени
        ///     для полей типа <see cref="DateTimeType" /> в базе данных.
        /// </summary>
        internal override string DateTimeValueCurrent => "current_timestamp";

        /// <summary>
        ///     Применить настройки к сессии.
        /// </summary>
        /// <param name="optionsBuilder">Набор интерфейсов настройки сессии.</param>
        public override void ConfigureContext(DbContextOptionsBuilder optionsBuilder)
        {
            object value = optionsBuilder.UseInMemoryDatabase(databaseName: "TestDatabase");
            optionsBuilder.EnableSensitiveDataLogging();
            optionsBuilder.ConfigureWarnings(builder => builder.Throw(RelationalEventId.MultipleCollectionIncludeWarning));
        }
    }
}
