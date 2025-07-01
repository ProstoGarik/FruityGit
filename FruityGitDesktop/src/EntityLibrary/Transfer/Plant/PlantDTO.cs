namespace EntitiesLibrary.Transfer.Plant
{
    public record PlantDTO : IdentifiableEntityDTO
    {
        public required string? Title { get; init; }
        public required string? BiologyTitle { get; init; }
        public required int GroupId { get; init; }
        public required string UserId { get; init; }
        public required int? WateringNeedId { get; init; }
        public required int? LightNeedId { get; init; }
        public required int? StageId { get; init; }

        public int? PlantTypeId { get; init; }
        public int? PlantVarietyId { get; init; }
        public int? ImageId { get; init; }
        public int? RipeningPeriod { get; init; }
        public string? Fertilization { get; init; }
        public string? Toxicity { get; init; }
        public string? Replacing { get; init; }
        public string? Description { get; init; }
    }
}
