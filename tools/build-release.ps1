# Builds one release of the game into dist\ (GitHub Actions runs this on every push to main, see
# .github/workflows/release.yml; it also works locally):
#   dist\Wymiary.zip             the game files + version.txt + js/version.js   (what the installer and updater download)
#   dist\Wymiary-instalator.exe  a small installer: downloads the newest Wymiary.zip from GitHub Releases and installs it
#   powershell -ExecutionPolicy Bypass -File tools\build-release.ps1 -Version 1.0.7
param([Parameter(Mandatory)][string]$Version, [string]$Repo)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'dist'
$stage = Join-Path ([IO.Path]::GetTempPath()) 'wymiary-release'
if (-not $Repo) { $Repo = (Get-Content (Join-Path $root 'launcher\repo.txt') -Raw).Trim() }
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw "Wersja ma mieć postać 1.2.3, a jest: $Version" }
Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $stage, $out | Out-Null
$utf8bom = New-Object Text.UTF8Encoding $true

# the distributed files = exactly what the game server offers to other players (server.js --manifest)
$manifest = & node (Join-Path $root 'server\server.js') --manifest | ConvertFrom-Json
$app = Join-Path $stage 'app'
foreach ($f in $manifest.files) {
  $to = Join-Path $app ($f.p -replace '/', '\')
  New-Item -ItemType Directory -Force (Split-Path -Parent $to) | Out-Null
  Copy-Item (Join-Path $root ($f.p -replace '/', '\')) $to
}
# PowerShell 5.1 reads scripts without a BOM as ANSI: make sure ours carry a UTF-8 BOM (Polish characters)
foreach ($f in Get-ChildItem $app -Recurse -Filter *.ps1) {
  $bytes = [IO.File]::ReadAllBytes($f.FullName)
  if (-not ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)) {
    [IO.File]::WriteAllText($f.FullName, [Text.Encoding]::UTF8.GetString($bytes), $utf8bom)
  }
}
Set-Content (Join-Path $app 'version.txt') $Version -Encoding ASCII
[IO.File]::WriteAllText((Join-Path $app 'js\version.js'),
  "// Written by tools/build-release.ps1 for this release.`nwindow.WYMIARY = { version: '$Version', repo: '$Repo' };`n")

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = Join-Path $out 'Wymiary.zip'
Remove-Item $zip -ErrorAction SilentlyContinue
[IO.Compression.ZipFile]::CreateFromDirectory($app, $zip, 'Optimal', $false)
'{0,-26} {1,8:N2} MB' -f 'Wymiary.zip', ((Get-Item $zip).Length / 1MB)

# the installer: a tiny .NET program (compiled with the C# compiler that ships with Windows) carrying install.ps1
$exeDir = Join-Path $stage 'exe'
New-Item -ItemType Directory -Force $exeDir | Out-Null
Copy-Item (Join-Path $app 'installer\install.ps1') $exeDir
$cs = @"
using System; using System.Diagnostics; using System.IO; using System.Reflection; using System.Windows.Forms;
[assembly: AssemblyTitle("Wymiary - instalator")]
[assembly: AssemblyProduct("Wymiary")]
[assembly: AssemblyDescription("Instaluje najnowszą wersję gry Wymiary z GitHuba")]
[assembly: AssemblyVersion("$Version.0")]
[assembly: AssemblyFileVersion("$Version.0")]
static class Setup {
  [STAThread] static int Main(string[] args) {
    try {
      string dir = Path.Combine(Path.GetTempPath(), "wymiary-setup-" + Process.GetCurrentProcess().Id);
      Directory.CreateDirectory(dir);
      string ps1 = Path.Combine(dir, "install.ps1");
      using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream("install.ps1"))
      using (FileStream f = File.Create(ps1)) s.CopyTo(f);
      string a = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"" + ps1 + "\" -Repo \"$Repo\"";
      foreach (string x in args) a += " \"" + x + "\"";
      ProcessStartInfo psi = new ProcessStartInfo(Path.Combine(Environment.SystemDirectory, @"WindowsPowerShell\v1.0\powershell.exe"), a);
      psi.UseShellExecute = false; psi.CreateNoWindow = true;
      Process p = Process.Start(psi);
      p.WaitForExit();
      try { Directory.Delete(dir, true); } catch { }
      return p.ExitCode;
    } catch (Exception e) {
      MessageBox.Show("Instalacja nie powiodła się:\n" + e.Message, "Wymiary", MessageBoxButtons.OK, MessageBoxIcon.Error);
      return 1;
    }
  }
}
"@
[IO.File]::WriteAllText((Join-Path $exeDir 'Setup.cs'), $cs, $utf8bom)
# asInvoker: no admin prompt (and no "installer detection" elevation because of the file name)
[IO.File]::WriteAllText((Join-Path $exeDir 'app.manifest'), @'
<?xml version="1.0" encoding="utf-8"?>
<assembly manifestVersion="1.0" xmlns="urn:schemas-microsoft-com:asm.v1">
  <assemblyIdentity version="1.0.0.0" name="Wymiary.Instalator"/>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v2"><security><requestedPrivileges xmlns="urn:schemas-microsoft-com:asm.v3">
    <requestedExecutionLevel level="asInvoker" uiAccess="false"/>
  </requestedPrivileges></security></trustInfo>
</assembly>
'@)
$exe = Join-Path $out 'Wymiary-instalator.exe'
Remove-Item $exe -ErrorAction SilentlyContinue
$csc = Join-Path $env:SystemRoot 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
Push-Location $exeDir
try {
  & $csc /nologo /target:winexe /optimize+ "/out:$exe" "/win32icon:$(Join-Path $root 'assets\icon.ico')" /win32manifest:app.manifest `
    /resource:install.ps1,install.ps1 /r:System.Windows.Forms.dll Setup.cs
  if ($LASTEXITCODE -ne 0) { throw "csc: kod $LASTEXITCODE" }
} finally { Pop-Location }
'{0,-26} {1,8:N2} MB' -f 'Wymiary-instalator.exe', ((Get-Item $exe).Length / 1MB)
"Wymiary $Version -> $out"
