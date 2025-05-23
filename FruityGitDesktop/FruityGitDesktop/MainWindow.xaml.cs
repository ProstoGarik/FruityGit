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

        private List<string> fullCommitHistory;
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
                if (ReposListBox.SelectedItem == null)
                {
                    MessageBox.Show("Please select a repository first.", "No Repository Selected",
                                  MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                string selectedRepo = ReposListBox.SelectedItem.ToString();
                using (var content = new MultipartFormDataContent())
                using (var fileStream = System.IO.File.OpenRead(selectedFlpPath))
                using (var fileContent = new StreamContent(fileStream))
                {
                    content.Add(fileContent, "file", System.IO.Path.GetFileName(selectedFlpPath));
                    content.Add(new StringContent(SummaryInputTextBox.Text), "summary");
                    content.Add(new StringContent(DescriptionInputTextBox.Text), "description");
                    content.Add(new StringContent("BasePC"), "userName");
                    content.Add(new StringContent("temp@mail.com"), "userEmail");

                    var response = await httpClient.PostAsync($"{serverPath}/api/git/{selectedRepo}/commit", content);

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
                var response = await httpClient.PostAsJsonAsync(
                    $"{serverPath}/api/git/{repoCreateName}/init",
                    string.Empty);

                if (response.IsSuccessStatusCode)
                {
                    await RefreshRepositoryList();
                    ReposListBox.SelectedItem = repoCreateName;
                    MessageBox.Show($"Repository '{repoCreateName}' created successfully!",
                                  "Success", MessageBoxButton.OK, MessageBoxImage.Information);
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

                fullCommitHistory = await response.Content.ReadFromJsonAsync<List<string>>();

                if (fullCommitHistory == null || fullCommitHistory.Count == 0)
                {
                    MessageBox.Show($"No commits found in repository '{selectedRepo}'.",
                                  "Commit History", MessageBoxButton.OK, MessageBoxImage.Information);
                    CommitsListBox.ItemsSource = null;
                    return;
                }

                // Display the commits
                CommitsListBox.ItemsSource = fullCommitHistory
                    .Select(commit =>
                    {
                        int startIndex = commit.IndexOf("_usEnd_");
                        if (startIndex < 0) return commit;

                        int endIndex = commit.IndexOf("_summEnd_", startIndex);
                        if (endIndex < 0) return commit.Substring(startIndex + 7);

                        return commit.Substring(startIndex + 7, endIndex - (startIndex + 7));
                    })
                    .ToList();

                CommitDetailsTextBox.Text = $"Repository: {selectedRepo}\nTotal Commits: {fullCommitHistory.Count}";
            }
            catch (Exception ex)
            {
                MessageBox.Show($"An error occurred: {ex.Message}", "Error",
                              MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void CommitsListBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (CommitsListBox.SelectedItem == null) return;

            var selectedCommit = fullCommitHistory[CommitsListBox.SelectedIndex].ToString();
            var commitDetails = new StringBuilder();

            int idEndIndex = selectedCommit.IndexOf("_idEnd_");
            string commitId = idEndIndex >= 0
                ? selectedCommit.Substring(0, idEndIndex).Trim()
                : "N/A";

            int userEndIndex = selectedCommit.IndexOf("_usEnd_");
            string commitUser = idEndIndex >= 0
                ? selectedCommit.Substring(idEndIndex + 7, userEndIndex-(idEndIndex + 7)).Trim()
                : "N/A";

            int summaryEndIndex = selectedCommit.IndexOf("_summEnd_");
            string commitDescription = "";
            if (summaryEndIndex >= 0 && idEndIndex >= 0)
            {
                int descriptionStart = summaryEndIndex + 9;
                int descriptionLength = descriptionStart - summaryEndIndex;
                if (descriptionLength > 0)
                {
                    commitDescription = selectedCommit.Substring(descriptionStart, descriptionLength).Trim();
                }
            }

            int descriptionEndIndex = selectedCommit.LastIndexOf("_descEnd_");
            string commitDate = descriptionEndIndex >= 0
                ? selectedCommit.Substring(descriptionEndIndex + 9).Trim()
                : "N/A";

            commitDetails.AppendLine($"Commit ID: {commitId}");
            commitDetails.AppendLine($"User: {commitDescription}");
            commitDetails.AppendLine($"Description: {commitDescription}");
            commitDetails.AppendLine($"Date: {commitDate}");

            CommitDetailsTextBox.Text = commitDetails.ToString();
        }
        private async Task RefreshRepositoryList()
        {
            try
            {
                var response = await httpClient.GetAsync($"{serverPath}/api/git/repositories");
                if (response.IsSuccessStatusCode)
                {
                    var repos = await response.Content.ReadFromJsonAsync<List<string>>();
                    ReposListBox.Items.Clear();
                    foreach (var repo in repos)
                    {
                        ReposListBox.Items.Add(repo);
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to refresh repositories: {ex.Message}",
                              "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async void RefreshRepoButton_Click(object sender, RoutedEventArgs e)
        {
            await RefreshRepositoryList();
        }
    }
}