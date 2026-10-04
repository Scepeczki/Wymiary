# Wymiary — installer. Installs the newest release from GitHub (github.com/<repo>/releases, asset Wymiary.zip).
# Runs from Wymiary-instalator.exe (tools/build-release.ps1 embeds this script), from Zainstaluj.cmd, and from
# launcher\update.ps1 (the updater runs the installer of the NEW version with -Source, so updates can also change
# shortcuts and registry entries).
# Per-user install (no admin rights): %LOCALAPPDATA%\Programs\Wymiary, shortcuts on the desktop and in the Start menu,
# an entry in "Apps & features", the wymiary:// link (the game's "Aktualizuj" button). runtime\ (Node.js) is kept.
#   -Source <dir>  install these already unpacked files      -Zip <file>   install from this release zip
#   -Update        keep the user's choice of desktop shortcuts (only refresh existing ones)
#   -Quiet         no dialogs (tests)    -Dest <dir>   install somewhere else (tests)    -NoShortcuts   (tests)
param([switch]$Quiet, [string]$Dest, [switch]$NoShortcuts, [string]$Zip, [string]$Source, [switch]$Update,
      [string]$Repo = 'Scepeczki/Wymiary')
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
if (-not $Dest) { $Dest = Join-Path $env:LOCALAPPDATA 'Programs\Wymiary' }
function Say($t, $i = 'Information') { if (-not $Quiet) { [System.Windows.Forms.MessageBox]::Show($t, 'Wymiary', 'OK', $i) | Out-Null } else { Write-Output $t } }
$wait = $null
function Busy($t) {
  if ($Quiet) { return }
  $script:wait = New-Object Windows.Forms.Form -Property @{ Text = 'Wymiary'; Width = 380; Height = 110; StartPosition = 'CenterScreen'
    FormBorderStyle = 'FixedDialog'; ControlBox = $false; TopMost = $true }
  $script:wait.Controls.Add((New-Object Windows.Forms.Label -Property @{ Text = $t; Dock = 'Fill'; TextAlign = 'MiddleCenter' }))
  $script:wait.Show(); [Windows.Forms.Application]::DoEvents()
}
function Done { if ($script:wait) { $script:wait.Close(); $script:wait = $null } }

$tmp = Join-Path $env:TEMP "wymiary-install-$PID"
try {
  if (-not $Source) {
    New-Item -ItemType Directory -Force $tmp | Out-Null
    if (-not $Zip) {
      Busy 'Pobieram najnowszą wersję gry z GitHuba...'
      $rel = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ 'User-Agent' = 'Wymiary-installer' } -TimeoutSec 20
      $asset = $rel.assets | Where-Object { $_.name -eq 'Wymiary.zip' } | Select-Object -First 1
      if (-not $asset) { throw "Wydanie $($rel.tag_name) na GitHubie nie ma pliku Wymiary.zip." }
      $Zip = Join-Path $tmp 'Wymiary.zip'
      Invoke-WebRequest $asset.browser_download_url -OutFile $Zip -UseBasicParsing -TimeoutSec 300
    }
    $Source = Join-Path $tmp 'new'
    Expand-Archive -Path $Zip -DestinationPath $Source -Force
  }
  if (-not (Test-Path (Join-Path $Source 'index.html'))) { throw "W $Source nie ma plików gry." }

  # a running server of an older version would lock runtime\node.exe
  Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith($Dest, 'OrdinalIgnoreCase') } | Stop-Process -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force $Dest | Out-Null
  # replace the program folders entirely (files removed in a new version must not linger); runtime\ stays
  foreach ($d in 'js', 'assets', 'server', 'launcher', 'installer') { Remove-Item -Recurse -Force (Join-Path $Dest $d) -ErrorAction SilentlyContinue }
  Copy-Item (Join-Path $Source '*') $Dest -Recurse -Force
  $version = (Get-Content (Join-Path $Dest 'version.txt') -Raw).Trim()
  Done

  if (-not $NoShortcuts) {
    $icon = Join-Path $Dest 'assets\icon.ico'
    $ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $shell = New-Object -ComObject WScript.Shell
    $desk = [Environment]::GetFolderPath('Desktop')
    $menu = Join-Path ([Environment]::GetFolderPath('Programs')) 'Wymiary'
    New-Item -ItemType Directory -Force $menu | Out-Null
    $make = {
      param($dir, $name, $target, $arguments, $desc)
      $path = Join-Path $dir "$name.lnk"
      if ($Update -and $dir -eq $desk -and -not (Test-Path $path)) { return }   # the user removed it: respect that
      $l = $shell.CreateShortcut($path)
      $l.TargetPath = $target; if ($arguments) { $l.Arguments = $arguments }
      $l.WorkingDirectory = $Dest; $l.IconLocation = "$icon,0"; $l.Description = $desc
      $l.Save()
    }
    $hidden = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File'
    foreach ($dir in @($desk, $menu)) {
      # the game shortcut goes through launcher\play.ps1: it checks GitHub for a newer version, then opens the game
      & $make $dir 'Wymiary' $ps "$hidden `"$Dest\launcher\play.ps1`"" 'Wymiary — gra (offline: zwiedzanie, boty)'
      & $make $dir 'Wymiary – dołącz do gry' $ps "$hidden `"$Dest\launcher\join.ps1`"" 'Połącz się z serwerem drugiego gracza'
      & $make $dir 'Wymiary – gra sieciowa (serwer)' (Join-Path $Dest 'launcher\host.cmd') '' 'Uruchom serwer gry na tym komputerze'
    }
    & $make $menu 'Wymiary – sprawdź aktualizacje' $ps "$hidden `"$Dest\launcher\update.ps1`"" 'Pobierz najnowszą wersję z GitHuba'
    & $make $menu 'Odinstaluj Wymiary' $ps "$hidden `"$Dest\launcher\uninstall.ps1`"" 'Usuń grę Wymiary'

    $key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Wymiary'
    New-Item -Force $key | Out-Null
    $props = @{ DisplayName = 'Wymiary'; DisplayVersion = $version; Publisher = 'Wymiary'; InstallLocation = $Dest; DisplayIcon = $icon; NoModify = 1; NoRepair = 1
      URLInfoAbout = "https://github.com/$Repo"; UninstallString = "`"$ps`" $hidden `"$Dest\launcher\uninstall.ps1`"" }
    foreach ($k in $props.Keys) { New-ItemProperty -Path $key -Name $k -Value $props[$k] -Force | Out-Null }

    # wymiary://update — the "Aktualizuj" button in the game menu opens it: updates and restarts the game
    $cls = 'HKCU:\Software\Classes\wymiary'
    New-Item -Force "$cls\shell\open\command" | Out-Null
    Set-Item $cls 'URL:Wymiary'
    New-ItemProperty -Path $cls -Name 'URL Protocol' -Value '' -Force | Out-Null
    Set-Item "$cls\shell\open\command" "`"$ps`" $hidden `"$Dest\launcher\update.ps1`" -Restart"
  }
  if (-not $Update) {
    Say "Zainstalowano Wymiary, wersja $version.`n`nNa pulpicie są skróty:`n• Wymiary — gra`n• Wymiary – dołącz do gry — gra z drugim graczem`n• Wymiary – gra sieciowa (serwer) — gdy to ty hostujesz`n`nGra sama sprawdza, czy na GitHubie jest nowa wersja."
  } else { Write-Output "Zainstalowano wersję $version" }
} catch {
  Done
  Say "Instalacja nie powiodła się:`n$($_.Exception.Message)" 'Error'
  exit 1
} finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
