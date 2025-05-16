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
            string repoCreateName = RepoNameTextBox.Text.Trim();

            // Validate repository name
            if (string.IsNullOrWhiteSpace(repoCreateName))
            {
                MessageBox.Show("Please enter a repository name", "Error",
                              MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            try
            {
                // Send request to create repository
                var response = await httpClient.PostAsJsonAsync(
                    $"{serverPath}/api/git/{repoCreateName}/init",
                    string.Empty);

                if (response.IsSuccessStatusCode)
                {
                    // Add to ListBox if not already present
                    if (!ReposListBox.Items.Contains(repoCreateName))
                    {
                        ReposListBox.Items.Add(repoCreateName);
                        // Optionally select the new repository
                        ReposListBox.SelectedItem = repoCreateName;
                    }

                    MessageBox.Show($"Repository '{repoCreateName}' created successfully!",
                                  "Success", MessageBoxButton.OK, MessageBoxImage.Information);

                    // Clear the text box
                    RepoNameTextBox.Text = string.Empty;
                }
                else
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    MessageBox.Show($"Failed to create repository: {errorContent}",
                                  "Error", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"An error occurred: {ex.Message}",
                              "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async void GetButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                // Check if a repository is selected
                if (ReposListBox.SelectedItem == null)
                {
                    MessageBox.Show("Please select a repository first.", "No Repository Selected",
                                  MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                string selectedRepo = ReposListBox.SelectedItem.ToString();

                // Make request to get history for the selected repository
                var response = await httpClient.GetAsync($"{serverPath}/api/git/{selectedRepo}/history");

                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    MessageBox.Show($"Error: {errorContent}", "Commit History",
                                  MessageBoxButton.OK, MessageBoxImage.Error);
                    return;
                }

                var commitHistory = await response.Content.ReadFromJsonAsync<List<string>>();

                if (commitHistory == null || commitHistory.Count == 0)
                {
                    MessageBox.Show($"No commits found in repository '{selectedRepo}'.",
                                  "Commit History", MessageBoxButton.OK, MessageBoxImage.Information);
                    return;
                }

                // Create a more detailed display of all commits
                var commitDetails = new StringBuilder();
                commitDetails.AppendLine($"Repository: {selectedRepo}");
                commitDetails.AppendLine($"Total Commits: {commitHistory.Count}");
                commitDetails.AppendLine();
                commitDetails.AppendLine("Commit History:");
                commitDetails.AppendLine("---------------");

                foreach (var commit in commitHistory)
                {
                    var commitParts = commit.Split(new[] { " - " }, StringSplitOptions.None);

                    if (commitParts.Length >= 3)
                    {
                        commitDetails.AppendLine($"ID: {commitParts[0]}");
                        commitDetails.AppendLine($"Message: {commitParts[1]}");
                        commitDetails.AppendLine($"Date: {commitParts[2]}");
                        commitDetails.AppendLine("---------------");
                    }
                    else
                    {
                        commitDetails.AppendLine(commit);
                        commitDetails.AppendLine("---------------");
                    }
                }

                // Show in a scrollable dialog instead of MessageBox
                var dialog = new Window
                {
                    Title = $"Commit History for {selectedRepo}",
                    Content = new ScrollViewer
                    {
                        Content = new TextBlock
                        {
                            Text = commitDetails.ToString(),
                            TextWrapping = TextWrapping.Wrap,
                            Margin = new Thickness(10),
                            FontFamily = new FontFamily("Consolas")
                        },
                        VerticalScrollBarVisibility = ScrollBarVisibility.Auto
                    },
                    Width = 600,
                    Height = 400,
                    WindowStartupLocation = WindowStartupLocation.CenterOwner
                };

                dialog.ShowDialog();
            }
            catch (Exception ex)
            {
                MessageBox.Show($"An error occurred: {ex.Message}", "Error",
                              MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }
}