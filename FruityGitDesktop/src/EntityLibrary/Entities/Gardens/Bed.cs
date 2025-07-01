namespace EntitiesLibrary.Gardens
{
    public class Bed
    {
        public int? Id { get; set; }
        public double X { get; set; }
        public double Y { get; set; }
        public int Width { get; set; }
        public int Height { get; set; }
        public double RotationAngle { get; set; }
        public string AdditionalInfo { get; set; } = string.Empty;
        public List<int> Plants { get; set; } = [];
    }
}