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
        private readonly HttpClient httpClient;
        private string selectedFlpPath;
        public MainWindow()
        {
            InitializeComponent();
            httpClient = new HttpClient();
            selectedFlpPath = string.Empty;
        }

        private async void SendButton_Click(object sender, RoutedEventArgs e)
        {
            using (var content = new MultipartFormDataContent())
            using (var fileStream = System.IO.File.OpenRead(selectedFlpPath))
            {
                var fileContent = new StreamContent(fileStream);
                content.Add(fileContent, "file", System.IO.Path.GetFileName(selectedFlpPath));

                content.Add(new StringContent(InputTextBox.Text), "message");
                content.Add(new StringContent("BasePC"), "userName");
                content.Add(new StringContent("temp@mail.com"), "userEmail");

                var response = await httpClient.PostAsync("http://localhost:5100/api/git/commit", content);
            }
        }

        private void AttachFileButton_Click(object sender, RoutedEventArgs e)
        {
            var openFileDialog = new Microsoft.Win32.OpenFileDialog
            {
                Filter = "FLP Files (*.flp)|*.flp",
                Title = "Выберите .flp файл"
            };

            if (openFileDialog.ShowDialog() == true)
            {
                string selectedFilePath = openFileDialog.FileName;

                selectedFlpPath = selectedFilePath;
            }
        }
    }
}