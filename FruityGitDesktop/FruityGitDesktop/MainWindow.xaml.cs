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
        private string serverPath = "http://192.168.1.54:8000";

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

                // Display the commits in the right upper list box
                // Display the commits in the right upper list box (showing only messages between "- " and "\n\n")
                CommitsListBox.ItemsSource = fullCommitHistory
                    .Select(commit =>
                    {
                        int startIndex = commit.IndexOf("- ");
                        if (startIndex < 0) return commit; // If "- " not found, return full commit

                        int endIndex = commit.IndexOf("\n\n", startIndex);
                        if (endIndex < 0) return commit.Substring(startIndex + 2); // If "\n\n" not found, return from "- " onwards

                        // Extract substring from after "- " to before "\n\n"
                        return commit.Substring(startIndex + 2, endIndex - (startIndex + 2));
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

            // Extract Commit ID (before the first "- ")
            int firstDashIndex = selectedCommit.IndexOf("- ");
            string commitId = firstDashIndex >= 0
                ? selectedCommit.Substring(0, firstDashIndex).Trim()
                : "N/A";

            // Extract Commit Description (between \n\n and the first "- ")
            int doubleNewlineIndex = selectedCommit.IndexOf("\n\n");
            string commitDescription = "";
            if (doubleNewlineIndex >= 0 && firstDashIndex >= 0)
            {
                int descriptionStart = doubleNewlineIndex + 2; // Skip \n\n
                int descriptionLength = firstDashIndex - descriptionStart;
                if (descriptionLength > 0)
                {
                    commitDescription = selectedCommit.Substring(descriptionStart, descriptionLength).Trim();
                }
            }

            // Extract Commit Date (after last "- ")
            int lastDashIndex = selectedCommit.LastIndexOf("- ");
            string commitDate = lastDashIndex >= 0
                ? selectedCommit.Substring(lastDashIndex + 2).Trim()
                : "N/A";

            commitDetails.AppendLine($"Commit ID: {commitId}");
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