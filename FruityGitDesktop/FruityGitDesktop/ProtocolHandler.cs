using Microsoft.Win32;
using System;
using System.Windows;

namespace FruityGitDesktop
{
    public static class ProtocolHandler
    {
        private const string ProtocolName = "fruitygit";

        public static void RegisterProtocol()
        {
            try
            {
                var executablePath = System.Diagnostics.Process.GetCurrentProcess().MainModule.FileName;
                var key = Registry.CurrentUser.CreateSubKey($@"Software\Classes\{ProtocolName}");
                key.SetValue("", $"URL:{ProtocolName} Protocol");
                key.SetValue("URL Protocol", "");

                var commandKey = key.CreateSubKey(@"shell\open\command");
                commandKey.SetValue("", $"\"{executablePath}\" \"%1\"");
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Failed to register protocol handler: {ex.Message}",
                              "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        public static Uri CreateLoginCallbackUri(string token = null)
        {
            var uriBuilder = new UriBuilder
            {
                Scheme = ProtocolName,
                Host = "login",
            };

            if (!string.IsNullOrEmpty(token))
            {
                uriBuilder.Query = $"token={Uri.EscapeDataString(token)}";
            }

            return uriBuilder.Uri;
        }
    }
} 