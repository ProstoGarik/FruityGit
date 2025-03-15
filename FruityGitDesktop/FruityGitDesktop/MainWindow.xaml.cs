using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;

namespace FruityGitDesktop
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        private static readonly HttpClient httpClient = new HttpClient();
        public MainWindow()
        {
            InitializeComponent();
        }

        private async void SendButton_Click(object sender, RoutedEventArgs e)
        {
            string Text = InputTextBox.Text;

            var commitRequest = new CommitRequest()
            {
                message = Text,
                UserName = "BasePC",
                UserEmail = "temp@mail.com"
            };

            var response = await httpClient.PostAsJsonAsync("http://localhost:5100/api/commit", commitRequest);
        }
    }
}