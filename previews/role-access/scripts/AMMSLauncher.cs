using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Reflection;
using System.Text.RegularExpressions;
using System.Windows.Forms;
using Microsoft.Win32;

internal static class AMMSLauncher
{
    [STAThread]
    private static void Main()
    {
        try
        {
#if !ADMIN
            string appDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AGRIDIAM", "AMMS-Access-Preview");
            Directory.CreateDirectory(appDir);
            string htmlPath = Path.Combine(appDir, "AMMS-Prototype.html");
            using (Stream resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("AMMS-Access-Preview.html"))
            using (FileStream output = File.Create(htmlPath))
                resource.CopyTo(output);
#endif

            string edge = FindEdge();
            if (edge == null)
                throw new InvalidOperationException("Microsoft Edge is required to run agriMAINT. Install Edge, then open agriMAINT.exe again.");

#if ADMIN
            string profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AGRIDIAM", "agriMAINT-Admin");
#else
            string profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "AMMS-Access-Preview");
            string previousProfile = Path.Combine(appDir, "browser-profile");
            if (!Directory.Exists(profile) && Directory.Exists(previousProfile)) CopyDirectory(previousProfile, profile);
#endif
            Directory.CreateDirectory(profile);
            string url = "http://127.0.0.1:4274/";
#if ADMIN
            while (!ServerReady(url))
            {
                if (MessageBox.Show("The agriMAINT server is unavailable. Start the server on this PC, then choose Retry.\r\n\r\nLe serveur agriMAINT est indisponible. Démarrez le serveur sur ce PC, puis cliquez sur Réessayer.", "agriMAINT", MessageBoxButtons.RetryCancel, MessageBoxIcon.Warning) != DialogResult.Retry) return;
            }
            url += "account-admin.html";
#else
            if (!ServerReady(url))
            {
                string portable = File.ReadAllText(htmlPath);
                string offline = Path.Combine(appDir, "connection-lost.html");
                File.WriteAllText(offline, Regex.Replace(portable, @"<script\b[^>]*>[\s\S]*?</script>", "", RegexOptions.IgnoreCase).Replace("</body>", "<style>dialog{border:1px solid #173747;border-radius:18px;padding:28px;color:#173747;background:white;font:20px Segoe UI;box-shadow:0 16px 48px #0003;z-index:99999}dialog::backdrop{background:#0002}dialog p{margin:0 0 24px}dialog button,dialog a{display:inline-block;padding:12px 20px;border-radius:8px;font:inherit;margin-right:12px}dialog a{background:#13873c;color:white;text-decoration:none}</style><dialog id='lost'><p>Connection lost / Connexion perdue</p><a href='http://127.0.0.1:4274/'>Retry / Réessayer</a><button type='button' onclick='window.close()'>Exit / Quitter</button></dialog><script>window.addEventListener('load',function(){let elapsed=0,last;function tick(now){if(last!==undefined&&!document.hidden)elapsed+=Math.min(now-last,100);last=now;if(elapsed<5000){requestAnimationFrame(tick);return;}document.getElementById('lost').showModal();}requestAnimationFrame(tick);});</script> </body>"));
                url = new Uri(offline).AbsoluteUri;
            }
#endif
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
