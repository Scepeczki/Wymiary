# Wymiary — uninstall (per-user installation: shortcut, registry entries, game folder). Started from "Apps & features".
Add-Type -AssemblyName System.Windows.Forms
$app = Split-Path -Parent $PSScriptRoot
$ok = [System.Windows.Forms.MessageBox]::Show("Odinstalować grę Wymiary?`n`n$app", 'Wymiary', 'YesNo', 'Question')
if ($ok -ne 'Yes') { exit }
# the game's window (own browser profile) and its server
Get-CimInstance Win32_Process -Filter "CommandLine LIKE '%Wymiary\\browser-profile%'" -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
$srv = (Join-Path $app 'server\server.js') -replace '\\', '\\'
Get-CimInstance Win32_Process -Filter "Name = 'node.exe' AND CommandLine LIKE '%$srv%'" -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith($app, 'OrdinalIgnoreCase') } | Stop-Process -Force -ErrorAction SilentlyContinue
$desk = [Environment]::GetFolderPath('Desktop')
$progs = [Environment]::GetFolderPath('Programs')
Get-ChildItem $desk -Filter 'Wymiary*.lnk' -ErrorAction SilentlyContinue | Remove-Item -Force
Remove-Item -Force (Join-Path $progs 'Wymiary.lnk') -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force (Join-Path $progs 'Wymiary') -ErrorAction SilentlyContinue      # Start menu folder of old versions
Remove-Item -Force 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Wymiary' -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force 'HKCU:\Software\Classes\wymiary' -ErrorAction SilentlyContinue
# the folder cannot delete itself while this script runs from it: remove it right after we exit
Start-Process cmd -ArgumentList "/c timeout /t 2 >nul & rmdir /s /q `"$app`"" -WindowStyle Hidden
[System.Windows.Forms.MessageBox]::Show('Wymiary zostały odinstalowane.', 'Wymiary') | Out-Null
