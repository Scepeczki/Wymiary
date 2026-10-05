# Wymiary — the one shortcut. Checks GitHub for a newer version (short timeout, so starting without Internet is not
# slowed down), starts the game's own server in the background (server\server.js --app on 127.0.0.1:47816) and opens
# the game in a browser app window. Hosting and joining network games happen inside the game (menu → Gra sieciowa).
# Started again while the game runs: just opens another window of the same game (one server).
# Without Node.js (and no way to download it) the game opens from disk: playing alone works, network games do not.
#   -NoUpdate   skip the update check (used after an update)
param([switch]$NoUpdate)
$ErrorActionPreference = 'SilentlyContinue'
$app = Split-Path -Parent $PSScriptRoot
$port = 47816
$url = "http://localhost:$port/"
$isRepo = Test-Path (Join-Path $app '.git')
if (-not $NoUpdate -and -not $isRepo) { & (Join-Path $PSScriptRoot 'update.ps1') -Ask -Timeout 3 }

# (127.0.0.1, not localhost: Windows PowerShell tries IPv6 first and loses a second on every check)
function Test-Server { try { $r = Invoke-RestMethod "http://127.0.0.1:$port/api/app" -Headers @{ 'X-Wymiary' = '1' } -TimeoutSec 2; return [bool]$r.app } catch { return $false } }

$open = $url
if (-not (Test-Server)) {
  $node = Join-Path $app 'runtime\node.exe'
  if (-not (Test-Path $node)) { $node = (Get-Command node -ErrorAction SilentlyContinue).Source }
  if (-not $node) {
    # first start without Node.js: fetch the portable one (about 30 MB) — the installer normally did this already
    Add-Type -AssemblyName System.Windows.Forms
    $f = New-Object Windows.Forms.Form -Property @{ Text = 'Wymiary'; Width = 380; Height = 110; StartPosition = 'CenterScreen'; FormBorderStyle = 'FixedDialog'; ControlBox = $false; TopMost = $true }
    $f.Controls.Add((New-Object Windows.Forms.Label -Property @{ Text = 'Pierwsze uruchomienie: pobieram Node.js (ok. 30 MB)...'; Dock = 'Fill'; TextAlign = 'MiddleCenter' }))
    $f.Show(); [Windows.Forms.Application]::DoEvents()
    & (Join-Path $PSScriptRoot 'get-node.ps1') | Out-Null
    $f.Close()
    $node = Join-Path $app 'runtime\node.exe'
    if (-not (Test-Path $node)) { $node = $null }
  }
  if ($node) {
    $logDir = Join-Path $env:LOCALAPPDATA 'Wymiary'
    New-Item -ItemType Directory -Force $logDir | Out-Null
    Start-Process $node -ArgumentList "`"$app\server\server.js`"", '--app', '--port', $port -WindowStyle Hidden `
      -RedirectStandardOutput (Join-Path $logDir 'server.log') -RedirectStandardError (Join-Path $logDir 'server-error.log')
    $t = 0
    while (-not (Test-Server) -and $t -lt 40) { Start-Sleep -Milliseconds 250; $t++ }
    if (-not (Test-Server)) { $open = $null }
  } else { $open = $null }
}
if (-not $open) { $open = 'file:///' + ((Join-Path $app 'index.html') -replace '\\', '/') }   # fallback: from disk, alone

$cands = @(
  "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe", "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe")
$browser = $cands | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
$bprof = Join-Path $env:LOCALAPPDATA 'Wymiary\browser-profile'
if ($browser) { Start-Process $browser -ArgumentList "--app=`"$open`"", "--user-data-dir=`"$bprof`"", '--start-maximized', '--no-first-run', '--no-default-browser-check' }
else { Start-Process $open }
