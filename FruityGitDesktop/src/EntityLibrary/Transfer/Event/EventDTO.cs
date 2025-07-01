namespace EntitiesLibrary.Transfer.Event
{
    public record EventDTO : IdentifiableEntityDTO
    {
        public required int PlantId { get; init; }
        public required string UserId { get; init; }
        public DateTime? Date { get; init; }
        public string? Title { get; init; }
    }
}
