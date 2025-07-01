using Microsoft.EntityFrameworkCore;

namespace EntitiesLibrary.Data
{
    public abstract class BaseConfiguration
    {
        internal abstract string DateTimeType { get; }

        internal abstract string DateTimeValueCurrent { get; }

        public abstract void ConfigureContext(DbContextOptionsBuilder optionsBuilder);
    }
}
