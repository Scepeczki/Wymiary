# Wymiary — installer. Two ways to run it:
#   * from the self-extracting .exe built by tools/build-installer.ps1 (files come from payload.zip next to it),
#   * from a copy of the repository (Zainstaluj.cmd, e.g. after "Code > Download ZIP" on GitHub).
# Per-user install (no admin rights): %LOCALAPPDATA%\Programs\Wymiary, shortcuts on the desktop and in the Start menu,
# an entry in "Apps & features". Installing over an existing copy updates it (settings and the bundled Node are kept).
#   -Quiet          no dialogs (tests)      -Dest <dir>   install somewhere else (tests)      -NoShortcuts
param([switch]$Quiet, [string]$Dest, [switch]$NoShortcuts)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
$src = $PSScriptRoot
if (-not $Dest) { $Dest = Join-Path $env:LOCALAPPDATA 'Programs\Wymiary' }
function Say($t, $i = 'Information') { if (-not $Quiet) { [System.Windows.Forms.MessageBox]::Show($t, 'Wymiary', 'OK', $i) | Out-Null } else { Write-Output $t } }

try {
  # a running server of an older version would lock runtime\node.exe
  Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith($Dest, 'OrdinalIgnoreCase') } | Stop-Process -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force $Dest | Out-Null
  $payload = Join-Path $src 'payload.zip'
  if (Test-Path $payload) { Expand-Archive -Path $payload -DestinationPath $Dest -Force }
  else {
    # repository mode: copy the game files from the repository folder (the parent of installer)
    $repoRoot = Split-Path -Parent $src
    foreach ($item in 'index.html', 'README.md', 'Zainstaluj.cmd', 'assets', 'js', 'server', 'launcher', 'installer') {
      $from = Join-Path $repoRoot $item
      if (Test-Path $from) { Copy-Item $from $Dest -Recurse -Force }
    }
    # the version = the newest commit on GitHub (so the first start does not offer the same version again)
    $repoFile = Join-Path $Dest 'launcher\repo.txt'
    $v = 'nieznana'
    if (Test-Path $repoFile) {
      try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $c = Invoke-RestMethod "https://api.github.com/repos/$((Get-Content $repoFile -Raw).Trim())/commits/main" -Headers @{ 'User-Agent' = 'Wymiary-installer' } -TimeoutSec 8
        $v = ([datetime]$c.commit.committer.date).ToString('yyyy.MM.dd') + '-' + $c.sha.Substring(0, 7)
      } catch {}
    }
    Set-Content (Join-Path $Dest 'version.txt') $v -Encoding ASCII
  }
  $version = (Get-Content (Join-Path $Dest 'version.txt') -Raw).Trim()
  $hasNode = Test-Path (Join-Path $Dest 'runtime\node.exe')

  if (-not $NoShortcuts) {
    $icon = Join-Path $Dest 'assets\icon.ico'
    $ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $shell = New-Object -ComObject WScript.Shell
    $menu = Join-Path ([Environment]::GetFolderPath('Programs')) 'Wymiary'
    New-Item -ItemType Directory -Force $menu | Out-Null
    $make = {
      param($dir, $name, $target, $arguments, $desc)
      $l = $shell.CreateShortcut((Join-Path $dir "$name.lnk"))
      $l.TargetPath = $target; if ($arguments) { $l.Arguments = $arguments }
      $l.WorkingDirectory = $Dest; $l.IconLocation = "$icon,0"; $l.Description = $desc
      $l.Save()
    }
    # the game shortcut goes through launcher\play.ps1: it checks GitHub for a newer version, then opens the game
    $play = @($ps, "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Dest\launcher\play.ps1`"")
    $join = @($ps, "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Dest\launcher\join.ps1`"")
    $hostL = @((Join-Path $Dest 'launcher\host.cmd'), '')
    foreach ($dir in @([Environment]::GetFolderPath('Desktop'), $menu)) {
      & $make $dir 'Wymiary' $play[0] $play[1] 'Wymiary — gra (offline: zwiedzanie, boty)'
      & $make $dir 'Wymiary – dołącz do gry' $join[0] $join[1] 'Połącz się z serwerem drugiego gracza (gra pobierze też aktualizacje)'
      & $make $dir 'Wymiary – gra sieciowa (serwer)' $hostL[0] $hostL[1] 'Uruchom serwer gry na tym komputerze'
    }
    & $make $menu 'Wymiary – sprawdź aktualizacje' $ps "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Dest\launcher\update.ps1`"" 'Pobierz najnowszą wersję z GitHuba'
    & $make $menu 'Odinstaluj Wymiary' $ps "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Dest\launcher\uninstall.ps1`"" 'Usuń grę Wymiary'

    $key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Wymiary'
    New-Item -Force $key | Out-Null
    $props = @{ DisplayName = 'Wymiary'; DisplayVersion = $version; Publisher = 'Wymiary'; InstallLocation = $Dest; DisplayIcon = $icon; NoModify = 1; NoRepair = 1
      UninstallString = "`"$ps`" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Dest\launcher\uninstall.ps1`"" }
    foreach ($k in $props.Keys) { New-ItemProperty -Path $key -Name $k -Value $props[$k] -Force | Out-Null }
  }
  $note = if ($hasNode) { '' } else { "`n`n(Gdy pierwszy raz uruchomisz serwer, gra sama pobierze potrzebny Node.js.)" }
  Say "Zainstalowano Wymiary, wersja $version.`n`nNa pulpicie są skróty:`n• Wymiary — gra`n• Wymiary – dołącz do gry — gra z drugim graczem (pobiera też aktualizacje)`n• Wymiary – gra sieciowa (serwer) — gdy to ty hostujesz$note"
} catch {
  Say "Instalacja nie powiodła się:`n$($_.Exception.Message)" 'Error'
  exit 1
}
