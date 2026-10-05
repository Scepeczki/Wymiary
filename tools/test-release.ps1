# Checks a built release the way a player gets it (GitHub Actions runs it after tools\build-release.ps1; works locally):
#   1. the zip has what the game needs (and nothing of the old three-shortcut launcher),
#   2. the installer installs it into a temporary folder (no shortcuts, no registry, no Node.js download),
#   3. the installed game's own server starts in app mode, serves the game, guards its API, and can host and stop.
#   powershell -ExecutionPolicy Bypass -File tools\test-release.ps1 [-Zip dist\Wymiary.zip]
param([string]$Zip, [int]$Port = 47999)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot
if (-not $Zip) { $Zip = Join-Path $root 'dist\Wymiary.zip' }
$dest = Join-Path ([IO.Path]::GetTempPath()) "wymiary-release-test-$PID"
$fail = 0
function Check($ok, $what) { if ($ok) { Write-Output "OK    $what" } else { Write-Output "BŁĄD  $what"; $script:fail++ } }
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw 'Do testu potrzebny jest Node.js w PATH.' }
$srv = $null
try {
  # 1. contents
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $z = [IO.Compression.ZipFile]::OpenRead((Resolve-Path $Zip))
  $names = $z.Entries | ForEach-Object { $_.FullName -replace '\\', '/' }
  $z.Dispose()
  foreach ($f in 'index.html', 'version.txt', 'js/version.js', 'js/main.js', 'server/server.js', 'launcher/play.ps1', 'launcher/update.ps1',
                 'launcher/get-node.ps1', 'launcher/uninstall.ps1', 'installer/install.ps1', 'assets/icon.ico') { Check ($names -contains $f) "paczka zawiera $f" }
  foreach ($f in 'launcher/host.cmd', 'launcher/join.ps1') { Check (-not ($names -contains $f)) "paczka nie zawiera $f" }
  Check (-not ($names | Where-Object { $_ -match '^(tools|\.git|dist|runtime)/' })) 'paczka bez tools/, .git/, dist/, runtime/'

  # 2. install
  $ps = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $out = & $ps -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'installer\install.ps1') -Zip $Zip -Dest $dest -Quiet -NoShortcuts -NoRuntime -Update
  Check ($LASTEXITCODE -eq 0) "instalacja ($($out -join ' '))"
  $version = (Get-Content (Join-Path $dest 'version.txt') -Raw).Trim()
  Check ($version -match '^\d+\.\d+\.\d+$') "version.txt = $version"
  Check ((Get-Content (Join-Path $dest 'js\version.js') -Raw) -match [regex]::Escape("version: '$version'")) 'js/version.js ma tę samą wersję'
  $bom = [IO.File]::ReadAllBytes((Join-Path $dest 'launcher\play.ps1'))[0..2] -join ','
  Check ($bom -eq '239,187,191') 'skrypty .ps1 z BOM UTF-8 (polskie znaki w PowerShell 5.1)'

  # 3. the game's own server, from the installed copy
  $srv = Start-Process $node -ArgumentList "`"$dest\server\server.js`"", '--app', '--port', $Port -PassThru -WindowStyle Hidden
  $base = "http://127.0.0.1:$Port"
  $h = @{ 'X-Wymiary' = '1' }
  $app = $null
  for ($i = 0; $i -lt 40 -and -not $app; $i++) { Start-Sleep -Milliseconds 250; try { $app = Invoke-RestMethod "$base/api/app" -Headers $h -TimeoutSec 2 } catch {} }
  Check ($app -and $app.app) 'serwer gry wystartował (tryb aplikacji)'
  Check ($app.release -eq $version) "serwer zna wersję wydania ($($app.release))"
  $page = Invoke-WebRequest "$base/" -UseBasicParsing -TimeoutSec 5
  Check ($page.Content -match '<title>Wymiary</title>' -and $page.Content -match 'js/netui.js') 'serwer podaje grę (index.html)'
  $forbidden = try { Invoke-WebRequest "$base/api/app" -UseBasicParsing -TimeoutSec 5 | Out-Null; $false } catch { $_.Exception.Response.StatusCode.value__ -eq 403 }
  Check $forbidden 'API bez nagłówka X-Wymiary jest zablokowane'
  $hidden = try { Invoke-WebRequest "$base/tools/test-release.ps1" -UseBasicParsing -TimeoutSec 5 | Out-Null; $false } catch { $true }
  Check $hidden 'pliki spoza gry nie są podawane'
  $set = Invoke-WebRequest "$base/api/settings" -Headers $h -UseBasicParsing -TimeoutSec 5
  Check ($set.StatusCode -eq 200 -and $set.Content.TrimStart().StartsWith('{')) 'ustawienia gracza (/api/settings) dostępne'
  $hst = Invoke-RestMethod "$base/api/host" -Method Post -Headers $h -TimeoutSec 5
  if ($hst.ok) {
    $m = Invoke-RestMethod "http://127.0.0.1:$($hst.host.port)/api/manifest" -TimeoutSec 5
    Check ($m.hash -eq $app.hash) "hostowanie: port $($hst.host.port) odpowiada tą samą wersją gry"
    $rem = Invoke-RestMethod "$base/api/remote?addr=127.0.0.1:$($hst.host.port)" -Headers $h -TimeoutSec 8
    Check ($rem.ok -and $rem.same) 'sprawdzenie wersji hosta (dołączanie) — zgodna'
    Invoke-RestMethod "$base/api/host/stop" -Method Post -Headers $h -TimeoutSec 5 | Out-Null
    $closed = try { Invoke-RestMethod "http://127.0.0.1:$($hst.host.port)/api/manifest" -TimeoutSec 2 | Out-Null; $false } catch { $true }
    Check $closed 'zakończenie hostowania zamyka port'
  } else { Write-Output "UWAGA hostowanie nie ruszyło: $($hst.error) (port zajęty na tym komputerze?)" }
} catch {
  Write-Output "BŁĄD  $($_.Exception.Message)"; $fail++
} finally {
  if ($srv) { Stop-Process -Id $srv.Id -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 300
  Remove-Item -Recurse -Force $dest -ErrorAction SilentlyContinue
}
if ($fail) { Write-Output "Test wydania: $fail błędów"; exit 1 }
Write-Output 'Test wydania: wszystko OK'
