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

        public UserInfo LoggedInUser { get; private set; }

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

                if (string.IsNullOrWhiteSpace(EmailTextBox.Text) || string.IsNullOrWhiteSpace(PasswordBox.Password))
                {
                    ErrorTextBlock.Text = "Please enter both email and password";
                    return;
                }

                var loginData = new
                {
                    email = EmailTextBox.Text,
                    password = PasswordBox.Password
                };

                Debug.WriteLine($"Sending login request to: {apiUrl}/api/auth/login");
                Debug.WriteLine($"Login data: {JsonSerializer.Serialize(loginData)}");

                var response = await httpClient.PostAsJsonAsync($"{apiUrl}/api/auth/login", loginData);
                var content = await response.Content.ReadAsStringAsync();
                
                Debug.WriteLine($"Response Status: {response.StatusCode}");
                Debug.WriteLine($"Response Content: {content}");
                Debug.WriteLine($"Response Headers: {string.Join(", ", response.Headers.Select(h => $"{h.Key}: {string.Join(", ", h.Value)}"))}");

                if (response.IsSuccessStatusCode)
                {
                    if (string.IsNullOrEmpty(content))
                    {
                        ErrorTextBlock.Text = "Server returned empty response";
                        return;
                    }

                    try
                    {
                        var loginResponse = JsonSerializer.Deserialize<LoginResponse>(content);
                        if (loginResponse?.AccessToken != null)
                        {
                            LoggedInUser = loginResponse.User;
                            LoggedInUser.Token = loginResponse.AccessToken;
                            DialogResult = true;
                            Close();
                            return;
                        }
                    }
                    catch (JsonException ex)
                    {
                        Debug.WriteLine($"JSON Deserialization Error: {ex}");
                        ErrorTextBlock.Text = "Error processing server response";
                        return;
                    }
                }
                else if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                {
                    ErrorTextBlock.Text = "Invalid email or password";
                    return;
                }
                else if (response.StatusCode == System.Net.HttpStatusCode.UnprocessableEntity)
                {
                    var validationErrors = JsonSerializer.Deserialize<ValidationErrorResponse>(content);
                    ErrorTextBlock.Text = string.Join("\n", validationErrors.Errors.SelectMany(e => e.Value));
                    return;
                }

                // If we get here, something else went wrong
                var errorResponse = JsonSerializer.Deserialize<ErrorResponse>(content);
                ErrorTextBlock.Text = errorResponse?.Error ?? "Login failed. Please try again.";
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"Login Error: {ex}");
                ErrorTextBlock.Text = $"An error occurred while connecting to the server: {ex.Message}";
            }
        }
    }

    public class LoginResponse
    {
        [JsonPropertyName("access_token")]
        public string AccessToken { get; set; }

        [JsonPropertyName("token_type")]
        public string TokenType { get; set; }

        [JsonPropertyName("expires_in")]
        public int ExpiresIn { get; set; }

        [JsonPropertyName("user")]
        public UserInfo User { get; set; }

        [JsonPropertyName("redirect_url")]
        public string RedirectUrl { get; set; }
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