using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging;

namespace EntitiesLibrary.Data
{

    /// <summary>
    ///     Конфигурация контекста для работы с базой данных.
    /// </summary>
    /// <param name="connectionString">Строка подключения к базе данных.</param>
    /// <param name="isDebugMode">Статус конфигурации для разработки.</param>
    public class ContextConfiguration(string connectionString,string serviceName) : BaseConfiguration
    {
        public string ConnectionString { get; } = connectionString;
        public string ServiceName { get; } = serviceName;
        private bool IsDebugMode { get; } = false;

        /// <summary>
        ///     Тип полей даты и времени в базе данных.
        /// </summary>
        internal override string DateTimeType => "timestamp";

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
            optionsBuilder.UseNpgsql(ConnectionString, x => x.MigrationsHistoryTable($"__{ServiceName}MigrationsHistory"));

            optionsBuilder.EnableSensitiveDataLogging();
            optionsBuilder.ConfigureWarnings(builder => builder.Throw(RelationalEventId.MultipleCollectionIncludeWarning));

            optionsBuilder.LogTo(Console.WriteLine, LogLevel.Information);
        }

    }
}
