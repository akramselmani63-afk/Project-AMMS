using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Reflection;
using System.Windows.Forms;
using Microsoft.Win32;

internal static class AMMSLauncher
{
    [STAThread]
    private static void Main()
    {
        try
        {
            string appDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AGRIDIAM", "AMMS-Access-Preview");
            Directory.CreateDirectory(appDir);
            string htmlPath = Path.Combine(appDir, "AMMS-Prototype.html");
            using (Stream resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("AMMS-Access-Preview.html"))
            using (FileStream output = File.Create(htmlPath))
                resource.CopyTo(output);

            string edge = FindEdge();
            if (edge == null)
                throw new InvalidOperationException("Microsoft Edge is required to run agriMAINT. Install Edge, then open agriMAINT.exe again.");

            string profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "AMMS-Access-Preview");
            string previousProfile = Path.Combine(appDir, "browser-profile");
            if (!Directory.Exists(profile) && Directory.Exists(previousProfile)) CopyDirectory(previousProfile, profile);
            Directory.CreateDirectory(profile);
            string url = "http://127.0.0.1:4274/";
            while (!ServerReady(url))
            {
                if (MessageBox.Show("The agriMAINT server is unavailable. Start the server on this PC, then choose Retry.\r\n\r\nLe serveur agriMAINT est indisponible. Démarrez le serveur sur ce PC, puis cliquez sur Réessayer.", "agriMAINT", MessageBoxButtons.RetryCancel, MessageBoxIcon.Warning) != DialogResult.Retry) return;
            }
            Process.Start(new ProcessStartInfo(edge, "--app=" + Quote(url) + " --user-data-dir=" + Quote(profile) + " --start-maximized --no-first-run --no-default-browser-check") { UseShellExecute = false });
        }
        catch (Exception ex)
        {
            MessageBox.Show("agriMAINT could not start.\r\n\r\n" + ex.Message, "agriMAINT", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private static bool ServerReady(string url)
    {
        try
        {
            HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url + "api/status");
            request.Timeout = 5000;
            request.ReadWriteTimeout = 5000;
            request.Proxy = null;
            using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
            using (StreamReader reader = new StreamReader(response.GetResponseStream()))
                return response.StatusCode == HttpStatusCode.OK && reader.ReadToEnd().Contains("\"mode\":\"server\"");
        }
        catch (WebException) { return false; }
    }

    private static string FindEdge()
    {
        string[] keys = { @"SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe", @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe" };
        foreach (RegistryHive hive in new[] { RegistryHive.CurrentUser, RegistryHive.LocalMachine })
        foreach (RegistryView view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
        foreach (string key in keys)
        {
            using (RegistryKey root = RegistryKey.OpenBaseKey(hive, view))
            using (RegistryKey app = root.OpenSubKey(key))
            {
                string path = app == null ? null : app.GetValue(null) as string;
                if (!String.IsNullOrEmpty(path) && File.Exists(path)) return path;
            }
        }
        string[] candidates = {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "Edge", "Application", "msedge.exe")
        };
        foreach (string path in candidates) if (File.Exists(path)) return path;
        return null;
    }

    private static string Quote(string value) { return "\"" + value.Replace("\"", "\\\"") + "\""; }

    private static void CopyDirectory(string source, string destination)
    {
        Directory.CreateDirectory(destination);
        foreach (string file in Directory.GetFiles(source)) File.Copy(file, Path.Combine(destination, Path.GetFileName(file)));
        foreach (string directory in Directory.GetDirectories(source)) CopyDirectory(directory, Path.Combine(destination, Path.GetFileName(directory)));
    }
}
