using System;
using System.Linq;
using System.Windows;
using System.Threading;

namespace FruityGitDesktop
{
    /// <summary>
    /// Interaction logic for App.xaml
    /// </summary>
    public partial class App : Application
    {
        private static Mutex _mutex = null;
        private const string AppName = "FruityGitDesktop";

        protected override void OnStartup(StartupEventArgs e)
        {
            // Check for existing instance
            _mutex = new Mutex(true, AppName, out bool createdNew);

            if (!createdNew)
            {
                // Another instance exists, try to activate it
                var existingWindow = System.Diagnostics.Process.GetProcessesByName(AppName)
                    .FirstOrDefault(p => p.Id != System.Diagnostics.Process.GetCurrentProcess().Id);

                if (existingWindow != null)
                {
                    // Bring existing window to front
                    NativeMethods.SetForegroundWindow(existingWindow.MainWindowHandle);
                }

                // Shutdown this instance
                Shutdown();
                return;
            }

            base.OnStartup(e);

            try
            {
                // Create and show main window
                var mainWindow = new MainWindow();
                mainWindow.Show();

                // Handle application exit
                mainWindow.Closed += (s, args) =>
                {
                    _mutex?.ReleaseMutex();
                    Shutdown();
                };
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Error starting application: {ex.Message}", "Error",
                    MessageBoxButton.OK, MessageBoxImage.Error);
                Shutdown();
            }
        }

        protected override void OnExit(ExitEventArgs e)
        {
            _mutex?.Dispose();
            base.OnExit(e);
        }
    }

    // Native methods for window management
    internal static class NativeMethods
    {
        [System.Runtime.InteropServices.DllImport("user32.dll")]
        [return: System.Runtime.InteropServices.MarshalAs(System.Runtime.InteropServices.UnmanagedType.Bool)]
        internal static extern bool SetForegroundWindow(IntPtr hWnd);
    }
}
