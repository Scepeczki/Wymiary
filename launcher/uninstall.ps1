# Wymiary — uninstall (per-user installation: shortcuts, Start menu folder, registry entry, game folder).
Add-Type -AssemblyName System.Windows.Forms
$app = Split-Path -Parent $PSScriptRoot
$ok = [System.Windows.Forms.MessageBox]::Show("Odinstalować grę Wymiary?`n`n$app", 'Wymiary', 'YesNo', 'Question')
if ($ok -ne 'Yes') { exit }
Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith($app, 'OrdinalIgnoreCase') } | Stop-Process -Force -ErrorAction SilentlyContinue
$desk = [Environment]::GetFolderPath('Desktop')
Get-ChildItem $desk -Filter 'Wymiary*.lnk' -ErrorAction SilentlyContinue | Remove-Item -Force
Remove-Item -Recurse -Force (Join-Path ([Environment]::GetFolderPath('Programs')) 'Wymiary') -ErrorAction SilentlyContinue
Remove-Item -Force 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Wymiary' -ErrorAction SilentlyContinue
# the folder cannot delete itself while this script runs from it: remove it right after we exit
Start-Process cmd -ArgumentList "/c timeout /t 2 >nul & rmdir /s /q `"$app`"" -WindowStyle Hidden
[System.Windows.Forms.MessageBox]::Show('Wymiary zostały odinstalowane.', 'Wymiary') | Out-Null
