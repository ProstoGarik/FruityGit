using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Windows;
using System.Windows.Controls;

namespace FruityGitDesktop
{
    public partial class MainWindow : Window
    {
        private readonly HttpClient httpClient;
        private string selectedFlpPath;
        private string serverPath = "http://192.168.1.54:8000";
        private string userToken;
        private string userName;
        private string userEmail;
        private List<string> fullCommitHistory;

        public MainWindow()
        {
            InitializeComponent();
            httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
            selectedFlpPath = string.Empty;
            UpdateLoginState(false);
        }

        private void UpdateLoginState(bool isLoggedIn)
        {
            if (isLoggedIn)
            {
                LoginButton.Content = new TextBlock { Text = userName ?? "Logged In" };
                AttachFileButton.IsEnabled = true;
                SendButton.IsEnabled = true;
                CreateRepoButton.IsEnabled = true;
            }
            else
            {
                LoginButton.Content = new TextBlock { Text = "Login" };
                userToken = null;
                userName = null;
                userEmail = null;
                AttachFileButton.IsEnabled = false;
                SendButton.IsEnabled = false;
                CreateRepoButton.IsEnabled = false;
            }
        }

        private void LoginButton_Click(object sender, RoutedEventArgs e)
        {
            var loginWindow = new LoginWindow(serverPath);
            if (loginWindow.ShowDialog() == true)
            {
                var user = loginWindow.LoggedInUser;
                userToken = user.Token;
                userName = user.Name;
                userEmail = user.Email;
                
                httpClient.DefaultRequestHeaders.Authorization = 
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", userToken);
                
                UpdateLoginState(true);
                RefreshRepositoryList();
            }
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
                    content.Add(new StringContent(userName), "userName");
                    content.Add(new StringContent(userEmail), "userEmail");

                    var response = await httpClient.PostAsync($"{serverPath}/api/git/{selectedRepo}/commit", content);
                    if (response.IsSuccessStatusCode)
                    {
                        MessageBox.Show("File committed successfully!", "Success",
                                      MessageBoxButton.OK, MessageBoxImage.Information);
                        SummaryInputTextBox.Clear();
                        DescriptionInputTextBox.Clear();
                        selectedFlpPath = string.Empty;
                        await RefreshCommitHistory(selectedRepo);
                    }
                    else
                    {
                        var error = await response.Content.ReadAsStringAsync();
                        MessageBox.Show($"Error committing file: {error}", "Error",
                                      MessageBoxButton.OK, MessageBoxImage.Error);
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error: {ex.Message}", "Error",
                              MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async void CreateRepoButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                string repoName = RepoNameTextBox.Text.Trim();
                if (string.IsNullOrEmpty(repoName))
                {
                    MessageBox.Show("Please enter a repository name.", "Missing Name",
                                  MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                var createRequest = new
                {
                    name = repoName,
                    isPrivate = false
                };

                var response = await httpClient.PostAsJsonAsync($"{serverPath}/api/repositories", createRequest);
                if (response.IsSuccessStatusCode)
                {
                    // Initialize Git repository after creating the database entry
                    var initResponse = await httpClient.PostAsync($"{serverPath}/api/git/{repoName}/init", null);
                    if (initResponse.IsSuccessStatusCode)
                    {
                        MessageBox.Show("Repository created successfully!", "Success",
                                      MessageBoxButton.OK, MessageBoxImage.Information);
                        RepoNameTextBox.Clear();
                        await RefreshRepositoryList();
                    }
                    else
                    {
                        var error = await initResponse.Content.ReadAsStringAsync();
                        MessageBox.Show($"Error initializing repository: {error}", "Error",
                                      MessageBoxButton.OK, MessageBoxImage.Error);
                    }
                }
                else
                {
                    var error = await response.Content.ReadAsStringAsync();
                    MessageBox.Show($"Error creating repository: {error}", "Error",
                                  MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error: {ex.Message}", "Error",
                              MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async Task RefreshRepositoryList()
        {
            try
            {
                var response = await httpClient.GetAsync($"{serverPath}/api/repositories");
                if (response.IsSuccessStatusCode)
                {
                    var repositories = await response.Content.ReadFromJsonAsync<List<Repository>>();
                    ReposListBox.ItemsSource = repositories?.Select(r => r.Name).ToList();
                }
                else
                {
                    var error = await response.Content.ReadAsStringAsync();
                    MessageBox.Show($"Error fetching repositories: {error}", "Error",
                                  MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error: {ex.Message}", "Error",
                              MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async Task RefreshCommitHistory(string repoName)
        {
            try
            {
                var response = await httpClient.GetAsync($"{serverPath}/api/git/{repoName}/history");
                if (response.IsSuccessStatusCode)
                {
                    fullCommitHistory = await response.Content.ReadFromJsonAsync<List<string>>();
                    UpdateCommitsList();
                }
                else
                {
                    var error = await response.Content.ReadAsStringAsync();
                    MessageBox.Show($"Error fetching commit history: {error}", "Error",
                                  MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error: {ex.Message}", "Error",
                              MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void UpdateCommitsList()
        {
            if (fullCommitHistory != null)
            {
                var displayList = new List<string>();
                foreach (var commit in fullCommitHistory)
                {
                    var parts = commit.Split(new[] { " _idEnd_ ", " _usEnd_ ", " _summEnd_ ", " _descEnd_ " }, StringSplitOptions.None);
                    if (parts.Length >= 4)
                    {
                        displayList.Add($"{parts[1]} - {parts[2]}");
                    }
                }
                CommitsListBox.ItemsSource = displayList;
            }
        }

        private void CommitsListBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (CommitsListBox.SelectedIndex >= 0 && fullCommitHistory != null)
            {
                var commit = fullCommitHistory[CommitsListBox.SelectedIndex];
                var parts = commit.Split(new[] { " _idEnd_ ", " _usEnd_ ", " _summEnd_ ", " _descEnd_ " }, StringSplitOptions.None);
                if (parts.Length >= 5)
                {
                    CommitDetailsTextBox.Text = $"Commit: {parts[0]}\nAuthor: {parts[1]}\nDate: {parts[4]}\n\nMessage:\n{parts[2]}\n\nDescription:\n{parts[3]}";
                }
            }
        }

        private void AttachFileButton_Click(object sender, RoutedEventArgs e)
        {
            var dialog = new Microsoft.Win32.OpenFileDialog();
            if (dialog.ShowDialog() == true)
            {
                selectedFlpPath = dialog.FileName;
                AttachFileButton.Content = new TextBlock { Text = System.IO.Path.GetFileName(selectedFlpPath) };
            }
        }

        private async void GetButton_Click(object sender, RoutedEventArgs e)
        {
            if (ReposListBox.SelectedItem != null)
            {
                string selectedRepo = ReposListBox.SelectedItem.ToString();
                await RefreshCommitHistory(selectedRepo);
            }
            else
            {
                MessageBox.Show("Please select a repository first.", "No Repository Selected",
                              MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        private async void RefreshRepoButton_Click(object sender, RoutedEventArgs e)
        {
            await RefreshRepositoryList();
        }
    }

    public class Repository
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public bool IsPrivate { get; set; }
        public int UserId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}