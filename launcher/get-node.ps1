# Wymiary — download a portable Node.js (only needed to HOST a network game) into runtime\node.exe.
# Uses the newest LTS release for 64-bit Windows from nodejs.org.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$app = Split-Path -Parent $PSScriptRoot
$rt = Join-Path $app 'runtime'
$rel = (Invoke-RestMethod 'https://nodejs.org/dist/index.json' -TimeoutSec 20) | Where-Object { $_.lts -and $_.files -contains 'win-x64-zip' } | Select-Object -First 1
$name = "node-$($rel.version)-win-x64"
Write-Output "Pobieram Node.js $($rel.version) (ok. 30 MB)..."
$tmp = Join-Path $env:TEMP "wymiary-node"
Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $tmp, $rt | Out-Null
Invoke-WebRequest "https://nodejs.org/dist/$($rel.version)/$name.zip" -OutFile "$tmp\node.zip" -UseBasicParsing -TimeoutSec 300
Expand-Archive "$tmp\node.zip" $tmp -Force
Copy-Item "$tmp\$name\node.exe" (Join-Path $rt 'node.exe') -Force
Remove-Item -Recurse -Force $tmp
Write-Output 'Node.js gotowy.'
