using EntitiesLibrary.Gardens;

namespace EntitiesLibrary.Transfer.Garden
{
    public record GardenDTO : IdentifiableEntityDTO
    {
        public required string UserId { get; init; }
        public required int GardenTypeId { get; set; }
        public required string Title{ get; set; }
        public List<Bed>? Beds { get; init; }
    }
}
