# Creates the "Wymiary" shortcut for THIS folder (the repository: desktop + project folder) — the same single shortcut
# the installer makes: launcher\play.ps1 starts the game's server in the background and opens the game window.
# A copy with .git is never updated from GitHub Releases (play.ps1 / update.ps1 skip it). Needs Node.js in PATH.
$root = Split-Path -Parent $PSScriptRoot
$icon = Join-Path $root 'assets\icon.ico'
if (-not (Test-Path $icon)) { & (Join-Path $PSScriptRoot 'make-icon.ps1') | Out-Null }
$ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$shell = New-Object -ComObject WScript.Shell
foreach ($dir in @([Environment]::GetFolderPath('Desktop'), $root)) {
  Remove-Item -Force (Join-Path $dir 'Wymiary - gra sieciowa.lnk') -ErrorAction SilentlyContinue   # old second shortcut
  $lnk = $shell.CreateShortcut((Join-Path $dir 'Wymiary.lnk'))
  $lnk.TargetPath = $ps
  $lnk.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$root\launcher\play.ps1`""
  $lnk.WorkingDirectory = $root
  $lnk.IconLocation = "$icon,0"
  $lnk.Description = 'Wymiary (kopia z repozytorium)'
  $lnk.Save()
}
Write-Output "Skrót Wymiary -> $root\launcher\play.ps1"
