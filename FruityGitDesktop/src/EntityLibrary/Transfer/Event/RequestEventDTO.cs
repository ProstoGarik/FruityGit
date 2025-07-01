namespace EntitiesLibrary.Transfer.Event
{
    public class RequestEventDTO
    {
        public required int PlantId { get; init; }
        public required string UserId { get; init; }
        public DateTime Date { get; init; }
        public int? Id { get; init; }
        public string? Title { get; init; }
    }
}
