using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Windows;
using System.Text.Json.Serialization;
using System.Diagnostics;
using System.Net.Http.Headers;

namespace FruityGitDesktop
{
    public partial class LoginWindow : Window
    {
        private readonly HttpClient httpClient;
        private readonly string apiUrl;

        public User LoggedInUser { get; private set; }

        public LoginWindow(string apiUrl)
        {
            InitializeComponent();
            this.apiUrl = apiUrl;
            httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
            httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        }

        private async void LoginButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                ErrorTextBlock.Text = string.Empty;

                if (string.IsNullOrWhiteSpace(EmailTextBox.Text) ||
                    string.IsNullOrWhiteSpace(PasswordBox.Password))
                {
                    ErrorTextBlock.Text = "Please enter both email and password";
                    return;
                }

                var loginData = new
                {
                    email = EmailTextBox.Text,
                    password = PasswordBox.Password
                };

                var response = await httpClient.PostAsJsonAsync($"{apiUrl}/api/auth/login", loginData);
                var content = await response.Content.ReadAsStringAsync();

                if (response.IsSuccessStatusCode)
                {
                    var loginResponse = JsonSerializer.Deserialize<LoginResponse>(content);

                    if (loginResponse?.Success == true && loginResponse.User != null)
                    {
                        // Store user information as needed
                        LoggedInUser = new User
                        {
                            Id = loginResponse.User.Id,
                            Name = loginResponse.User.Name,
                            Email = loginResponse.User.Email
                        };

                        DialogResult = true;
                        Close();
                    }
                    else
                    {
                        ErrorTextBlock.Text = "Login failed: Invalid response from server";
                    }
                }
                else if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                {
                    ErrorTextBlock.Text = "Invalid email or password";
                }
                else
                {
                    ErrorTextBlock.Text = $"Login failed: {response.ReasonPhrase}";
                }
            }
            catch (Exception ex)
            {
                ErrorTextBlock.Text = $"An error occurred: {ex.Message}";
                Debug.WriteLine($"Login error: {ex}");
            }
        }
    }

    public class LoginResponse
    {
        public bool Success { get; set; }
        public User User { get; set; }
    }

    public class ValidationErrorResponse
    {
        [JsonPropertyName("errors")]
        public Dictionary<string, string[]> Errors { get; set; }
    }

    public class ErrorResponse
    {
        [JsonPropertyName("error")]
        public string Error { get; set; }
    }
} 