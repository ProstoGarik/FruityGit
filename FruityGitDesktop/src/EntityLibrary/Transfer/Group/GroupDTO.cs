namespace EntitiesLibrary.Transfer.Group
{
    public record GroupDTO : IdentifiableEntityDTO
    {
        public required string UserId { get; init; }
        public string? Title { get; init; }
    };
}
