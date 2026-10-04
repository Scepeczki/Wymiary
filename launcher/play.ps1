# Wymiary — start the game (offline: exploring, bots). Checks GitHub for a newer version first (short timeout, so
# starting without Internet is not slowed down), then opens the game in a browser app window.
param([switch]$NoUpdate)
$ErrorActionPreference = 'SilentlyContinue'
$app = Split-Path -Parent $PSScriptRoot
if (-not $NoUpdate) { & (Join-Path $PSScriptRoot 'update.ps1') -Ask -Timeout 3 }
$index = Join-Path $app 'index.html'
$url = 'file:///' + ($index -replace '\\', '/')
$cands = @(
  "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe", "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe")
$browser = $cands | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
$bprof = Join-Path $env:LOCALAPPDATA 'Wymiary\browser-profile'
if ($browser) { Start-Process $browser -ArgumentList "--app=`"$url`"", "--user-data-dir=`"$bprof`"", '--start-maximized', '--no-first-run', '--no-default-browser-check' }
else { Start-Process $index }
