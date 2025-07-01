
using EntitiesLibrary.Gardens;

namespace EntitiesLibrary.Transfer.Garden
{
    public record RequestGardenDTO
    {
        public int? Id { get; init; }
        public required string UserId { get; init; }
        public required string Title { get; init; }
        public required int GardenTypeId { get; init; }
        public List<Bed>? Beds { get; init; }
    }
}
