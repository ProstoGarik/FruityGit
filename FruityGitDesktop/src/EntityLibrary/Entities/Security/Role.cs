namespace EntitiesLibrary
{
    public class Role
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string Permission { get; set; } = "";
        public int TokenLifetimeSeconds { get; set; }
        public bool CanRegister { get; set; }
    }
}
