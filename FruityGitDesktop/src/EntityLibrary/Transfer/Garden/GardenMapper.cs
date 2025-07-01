using EntitiesLibrary.Gardens;

namespace EntitiesLibrary.Transfer.Garden
{
    public static class GardenMapper
    {
        public static Gardens.Garden ToEntity(this RequestGardenDTO requestGarden)
        {
            return new Gardens.Garden
            {
                Id = requestGarden.Id,
                Title = requestGarden.Title,
                UserId = requestGarden.UserId,
                Beds = requestGarden.Beds ?? [],
                GardenTypeId = requestGarden.GardenTypeId
            };
        }


        public static GardenDTO ToDTO(this Gardens.Garden garden)
        {
            return new GardenDTO
            {
                Id = garden.Id,
                Title = garden.Title,
                UserId = garden.UserId,
                Beds = garden.Beds,
                GardenTypeId = garden.GardenTypeId,
                CreatedAt = garden.CreatedAt,
                UpdatedAt = garden.UpdatedAt
            };
        }
    }
}
