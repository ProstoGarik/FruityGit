namespace EntitiesLibrary.Transfer
{
    public record IdentifiableEntityDTO : EntityDTO
    {
        public int? Id { get; init; }
    }
}
