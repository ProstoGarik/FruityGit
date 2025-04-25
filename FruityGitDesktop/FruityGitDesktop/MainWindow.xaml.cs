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
using static System.Net.WebRequestMethods;

namespace FruityGitDesktop
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        private readonly HttpClient httpClient;
        private string selectedFlpPath;
        private string serverPath = "http://192.168.135.58:8000";
        public MainWindow()
        {
            InitializeComponent();
            httpClient = new HttpClient();
            selectedFlpPath = string.Empty;
        }

        private async void SendButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                using (var content = new MultipartFormDataContent())
                using (var fileStream = System.IO.File.OpenRead(selectedFlpPath))
                using (var fileContent = new StreamContent(fileStream))
                {
                    content.Add(fileContent, "file", System.IO.Path.GetFileName(selectedFlpPath));
                    content.Add(new StringContent(InputTextBox.Text), "message");
                    content.Add(new StringContent("BasePC"), "userName");
                    content.Add(new StringContent("temp@mail.com"), "userEmail");

                    var response = await httpClient.PostAsync(serverPath + "/api/git/commit", content);

                    if (!response.IsSuccessStatusCode)
                    {
                        var errorContent = await response.Content.ReadAsStringAsync();
                        MessageBox.Show(errorContent);
                    }
                    else
                    {
                        var responseContent = await response.Content.ReadAsStringAsync();
                        MessageBox.Show(responseContent);
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.ToString());
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

        private async void CreateRepoButton_Click(object sender, RoutedEventArgs e)
        {
            await httpClient.PostAsJsonAsync(serverPath + "/api/git/init", string.Empty);
        }

        private async void GetButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                // Get the commit history
                var response = await httpClient.GetAsync(serverPath + "/api/git/history");

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    MessageBox.Show($"Error: {errorContent}", "Commit History", MessageBoxButton.OK, MessageBoxImage.Error);
                    return;
                }

                // Parse the response
                var commitHistory = await response.Content.ReadFromJsonAsync<List<string>>();

                if (commitHistory == null || commitHistory.Count == 0)
                {
                    MessageBox.Show("No commits found in the repository.", "Commit History", MessageBoxButton.OK, MessageBoxImage.Information);
                    return;
                }

                // Get the most recent commit (first in the list)
                var lastCommit = commitHistory.First();

                // Display commit information in a more readable format
                var commitParts = lastCommit.Split(new[] { " - " }, StringSplitOptions.None);
                var commitDetails = new StringBuilder();

                if (commitParts.Length >= 3)
                {
                    commitDetails.AppendLine($"Commit ID: {commitParts[0]}");
                    commitDetails.AppendLine($"Message: {commitParts[1]}");
                    commitDetails.AppendLine($"Date: {commitParts[2]}");
                }
                else
                {
                    commitDetails.AppendLine(lastCommit);
                }

                MessageBox.Show(commitDetails.ToString(), "Last Commit Details", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"An error occurred: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }
}