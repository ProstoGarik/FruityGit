
using EntitiesLibrary.Common;

namespace EntitiesLibrary.Transfer.Common
{
    public static class EventMapper
    {
        public static T ToEntity<T>(this RequestCommonDTO common) where T : CommonEntity, new()
        {
            return new T
            {

                Title = common.Title
            };
        }


        public static T ToDTO<T>(this CommonEntity common) where T : CommonDTO, new()
        {
            return new T
            {
                Id = common.Id,
                Title = common.Title!,
                CreatedAt = common.CreatedAt,
                UpdatedAt = common.UpdatedAt
            };
        }
    }
}

