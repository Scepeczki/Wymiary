# Wymiary — join a network game.
# Asks for the host's address, brings this copy of the game up to the host's version (downloads only the files whose
# hash differs — that is how updates arrive), then opens the game connected to the host.
#   -HostAddr 192.168.1.55:8080   skip the question      -NoLaunch   only update (used by tests)
param([string]$HostAddr, [switch]$NoLaunch)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName Microsoft.VisualBasic, System.Windows.Forms
$app = Split-Path -Parent $PSScriptRoot
$cfgDir = Join-Path $env:LOCALAPPDATA 'Wymiary'
$cfgFile = Join-Path $cfgDir 'config.json'
New-Item -ItemType Directory -Force $cfgDir | Out-Null
$cfg = @{ host = '' }
if (Test-Path $cfgFile) { try { $c = Get-Content $cfgFile -Raw | ConvertFrom-Json; $cfg.host = $c.host } catch {} }

function Say($text, $icon = 'Information') {
  if (-not $NoLaunch) { [System.Windows.Forms.MessageBox]::Show($text, 'Wymiary', 'OK', $icon) | Out-Null } else { Write-Output $text }
}

if (-not $HostAddr) {
  $HostAddr = [Microsoft.VisualBasic.Interaction]::InputBox(
    "Adres komputera z serwerem gry — pokazuje go okno serwera u drugiego gracza.`n`nPrzykłady:`n   192.168.1.55:8080   (ta sama sieć Wi-Fi)`n   100.101.102.103:8080   (przez Tailscale)",
    'Wymiary – dołącz do gry', $cfg.host)
}
$HostAddr = ($HostAddr -replace '^\s*https?://', '' -replace '/.*$', '').Trim()
if (-not $HostAddr) { exit }
if ($HostAddr -notmatch ':\d+$') { $HostAddr += ':8080' }
$base = "http://$HostAddr"

try { $m = Invoke-RestMethod "$base/api/manifest" -TimeoutSec 6 }
catch {
  Say "Nie mogę połączyć się z $HostAddr.`n`n• Czy na tamtym komputerze działa 'Wymiary – gra sieciowa (serwer)'?`n• Czy adres jest dobry (okno serwera go pokazuje)?`n• Czy jesteście w tej samej sieci albo oba komputery mają włączony Tailscale?`n• Czy zapora Windows na tamtym komputerze pozwala na połączenie?" 'Warning'
  exit 1
}
$cfg.host = $HostAddr
$cfg | ConvertTo-Json | Set-Content $cfgFile -Encoding UTF8

# ---- update: download every file whose SHA-256 differs from the host's ----
$changed = 0
foreach ($f in $m.files) {
  $local = Join-Path $app ($f.p -replace '/', '\')
  $same = (Test-Path $local) -and ((Get-FileHash $local -Algorithm SHA256).Hash.ToLower() -eq $f.sha)
  if ($same) { continue }
  New-Item -ItemType Directory -Force (Split-Path -Parent $local) | Out-Null
  $url = $base + '/' + (($f.p -split '/' | ForEach-Object { [uri]::EscapeDataString($_) }) -join '/')
  Invoke-WebRequest $url -OutFile "$local.part" -UseBasicParsing -TimeoutSec 30
  if ((Get-FileHash "$local.part" -Algorithm SHA256).Hash.ToLower() -ne $f.sha) { Remove-Item "$local.part"; throw "Uszkodzony plik: $($f.p)" }
  Move-Item -Force "$local.part" $local
  $changed++
}
$old = if (Test-Path (Join-Path $app 'version.txt')) { (Get-Content (Join-Path $app 'version.txt') -Raw).Trim() } else { '?' }
Set-Content (Join-Path $app 'version.txt') $m.version -Encoding ASCII
if ($changed -gt 0) { Say "Gra zaktualizowana: $old → $($m.version)  ($changed plików)." }
elseif ($NoLaunch) { Write-Output "Aktualna wersja: $($m.version)" }
if ($NoLaunch) { exit 0 }

# ---- launch the game from the host (same version for everybody) ----
$url = "$base/"
$cands = @(
  "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe", "$env:LOCALAPPDATA\BraveSoftware\Brave-Browser\Application\brave.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe", "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe")
$browser = $cands | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if ($browser) {
  Start-Process $browser -ArgumentList "--app=`"$url`"", "--user-data-dir=`"$cfgDir\browser-profile`"", '--start-maximized', '--no-first-run', '--no-default-browser-check'
} else { Start-Process $url }
