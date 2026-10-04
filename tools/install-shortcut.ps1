# Creates a "Wymiary" shortcut (desktop + project folder) that opens the game as a standalone app window.
$root = Split-Path -Parent $PSScriptRoot
$index = Join-Path $root 'index.html'
$icon = Join-Path $root 'assets\icon.ico'
if (-not (Test-Path $icon)) { & (Join-Path $PSScriptRoot 'make-icon.ps1') | Out-Null }

$candidates = @(
  "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe",
  "${env:ProgramFiles(x86)}\BraveSoftware\Brave-Browser\Application\brave.exe",
  "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)
$browser = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

$url = 'file:///' + ($index -replace '\\', '/')
$bprof = Join-Path $env:LOCALAPPDATA 'Wymiary\browser-profile'
$shell = New-Object -ComObject WScript.Shell

foreach ($dir in @([Environment]::GetFolderPath('Desktop'), $root)) {
  $lnk = $shell.CreateShortcut((Join-Path $dir 'Wymiary.lnk'))
  if ($browser) {
    $lnk.TargetPath = $browser
    $lnk.Arguments = "--app=`"$url`" --user-data-dir=`"$bprof`" --start-maximized --ignore-gpu-blocklist --no-first-run --no-default-browser-check"
  } else {
    $lnk.TargetPath = $index   # fallback: default browser
  }
  $lnk.WorkingDirectory = $root
  $lnk.IconLocation = "$icon,0"
  $lnk.Description = 'Wymiary - FPS w nieeuklidesowych przestrzeniach'
  $lnk.Save()
}
if ($browser) { Write-Output "Shortcut -> $browser (app mode)" } else { Write-Output 'Shortcut -> default browser (no Chromium browser found)' }

# Multiplayer: a second shortcut that starts the game server (and opens the game)
$bat = Join-Path $root 'launcher\host.cmd'
foreach ($dir in @([Environment]::GetFolderPath('Desktop'), $root)) {
  $lnk = $shell.CreateShortcut((Join-Path $dir 'Wymiary - gra sieciowa.lnk'))
  $lnk.TargetPath = $bat
  $lnk.WorkingDirectory = $root
  $lnk.IconLocation = "$icon,0"
  $lnk.Description = 'Wymiary - serwer gry sieciowej (dla Ciebie i drugiego gracza w tej samej sieci)'
  $lnk.Save()
}
Write-Output 'Multiplayer shortcut created'
