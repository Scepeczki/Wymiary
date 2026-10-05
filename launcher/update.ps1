# Wymiary — update this copy of the game from GitHub Releases (the repository named in launcher\repo.txt).
# Compares the latest release with version.txt; if it is different, downloads its Wymiary.zip and runs the installer
# of the new version over this installation.
#   -Ask       ask before updating (the game shortcut)        -Quiet   no dialogs (tests / scripts)
#   -Restart   started by wymiary://update (the game's "Aktualizuj" button): close the game, update, start it again
#   -Timeout   seconds for the check (the game shortcut uses a short one so starting offline is not slowed down)
param([switch]$Ask, [switch]$Quiet, [switch]$Restart, [int]$Timeout = 8, [Parameter(ValueFromRemainingArguments)]$Rest)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$app = Split-Path -Parent $PSScriptRoot
function Say($t, $i = 'Information') { if (-not $Quiet) { [System.Windows.Forms.MessageBox]::Show($t, 'Wymiary', 'OK', $i) | Out-Null } else { Write-Output $t } }

# a working copy of the repository is never overwritten by a release
if (Test-Path (Join-Path $app '.git')) { if (-not $Ask) { Say 'To kopia z repozytorium (git) — aktualizacje z GitHub Releases jej nie dotyczą.' }; exit 0 }
$repoFile = Join-Path $PSScriptRoot 'repo.txt'
if (-not (Test-Path $repoFile)) { if (-not $Ask) { Say 'Brak launcher\repo.txt - nie wiem, skąd pobierać aktualizacje.' 'Warning' }; exit 0 }
$repo = (Get-Content $repoFile -Raw).Trim()
try { $rel = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest" -Headers @{ 'User-Agent' = 'Wymiary-updater' } -TimeoutSec $Timeout }
catch { if (-not $Ask) { Say "Nie mogę sprawdzić aktualizacji na GitHubie ($repo).`n$($_.Exception.Message)" 'Warning' }; exit 0 }
$newVersion = $rel.tag_name -replace '^v', ''
$asset = $rel.assets | Where-Object { $_.name -eq 'Wymiary.zip' } | Select-Object -First 1
$verFile = Join-Path $app 'version.txt'
$current = if (Test-Path $verFile) { (Get-Content $verFile -Raw).Trim() } else { '' }
if ($current -eq $newVersion -or -not $asset) { if (-not $Ask) { Say "Masz najnowszą wersję: $current" }; exit 0 }

if ($Ask -and -not $Quiet) {
  $notes = (($rel.body -split "`n") | Where-Object { $_ -match '^\s*- ' } | Select-Object -First 6) -join "`n"
  $msg = "Na GitHubie jest nowa wersja gry: $newVersion`nTwoja wersja: $(if ($current) { $current } else { 'nieznana' })`n`n$notes`n`nZaktualizować teraz?"
  if ([System.Windows.Forms.MessageBox]::Show($msg, 'Wymiary – aktualizacja', 'YesNo', 'Question') -ne 'Yes') { exit 0 }
}

$wait = $null
if (-not $Quiet) {
  $wait = New-Object Windows.Forms.Form -Property @{ Text = 'Wymiary'; Width = 380; Height = 110; StartPosition = 'CenterScreen'
    FormBorderStyle = 'FixedDialog'; ControlBox = $false; TopMost = $true }
  $wait.Controls.Add((New-Object Windows.Forms.Label -Property @{ Text = "Pobieram wersję $newVersion..."; Dock = 'Fill'; TextAlign = 'MiddleCenter' }))
  $wait.Show(); [Windows.Forms.Application]::DoEvents()
}
$tmp = Join-Path $env:TEMP "wymiary-update-$newVersion"
$ok = $false
try {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force $tmp | Out-Null
  Invoke-WebRequest $asset.browser_download_url -OutFile "$tmp\Wymiary.zip" -UseBasicParsing -TimeoutSec 300
  Expand-Archive "$tmp\Wymiary.zip" "$tmp\new" -Force
  if ($Restart) {
    # the game window runs in its own browser profile (see play.ps1): close just that one
    Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%Wymiary\\browser-profile%'" -ErrorAction SilentlyContinue |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 500
  }
  # the installer of the NEW version does the copying (it may know about new files, shortcuts, ...)
  $ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $out = & $ps -NoProfile -ExecutionPolicy Bypass -File "$tmp\new\installer\install.ps1" -Source "$tmp\new" -Dest $app -Update -Quiet -Repo $repo
  if ($LASTEXITCODE -ne 0) { throw ($out -join "`n") }
  $ok = $true
} catch {
  if ($wait) { $wait.Close() }
  Say "Aktualizacja nie powiodła się:`n$($_.Exception.Message)" 'Error'
} finally {
  if ($wait) { $wait.Close() }
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
if ($ok) {
  if ($Restart) { & (Join-Path $PSScriptRoot 'play.ps1') -NoUpdate }
  elseif (-not $Ask) { Say "Gra zaktualizowana do wersji $newVersion." }
}
