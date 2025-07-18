namespace EntitiesLibrary.Security
{
    public class RegisterRequest : SecurityRequest
    {
        public required string UserName { get; set; }
        public string RoleName { get; set; } = "";
    }
}