namespace EntitiesLibrary.Transfer.Group
{
    public record RequestGroupDTO
    {
        public int? Id { get; init; }
        public required string UserId { get; init; }
        public string? Title { get; init; }
    }
}
