using System;
using System.Configuration;
using System.Data;
using System.Windows;
using System.Linq;

namespace FruityGitDesktop
{
    /// <summary>
    /// Interaction logic for App.xaml
    /// </summary>
    public partial class App : Application
    {
        private MainWindow mainWindow;

        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);
            
            // Register the protocol handler
            ProtocolHandler.RegisterProtocol();

            // Create main window
            mainWindow = new MainWindow();
            mainWindow.Show();

            // Handle any protocol activation that came with startup
            if (e.Args.Length > 0)
            {
                HandleProtocolActivation(e.Args[0]);
            }
        }

        private void HandleProtocolActivation(string uri)
        {
            if (uri.StartsWith("fruitygit://login"))
            {
                var token = uri.Split('?')
                              .Skip(1)
                              .FirstOrDefault()?
                              .Split('=')
                              .Skip(1)
                              .FirstOrDefault();

                if (!string.IsNullOrEmpty(token))
                {
                    mainWindow?.HandleLoginCallback(Uri.UnescapeDataString(token));
                }
            }
        }
    }
}
