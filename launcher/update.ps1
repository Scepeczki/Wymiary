# Wymiary — update this copy of the game from GitHub (the repository named in launcher\repo.txt, branch main).
# Compares the newest commit with version.txt; if there is a newer one, downloads the repository as a zip and copies
# the game files over this installation.
#   -Ask       ask before updating (used by the game shortcut)     -Quiet   no dialogs (tests / scripts)
#   -Timeout   seconds for the check (the game shortcut uses a short one so starting offline is not slowed down)
param([switch]$Ask, [switch]$Quiet, [int]$Timeout = 8)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$app = Split-Path -Parent $PSScriptRoot
function Say($t, $i = 'Information') { if (-not $Quiet) { [System.Windows.Forms.MessageBox]::Show($t, 'Wymiary', 'OK', $i) | Out-Null } else { Write-Output $t } }

$repoFile = Join-Path $PSScriptRoot 'repo.txt'
if (-not (Test-Path $repoFile)) { if (-not $Ask) { Say 'Brak launcher\repo.txt - nie wiem, skąd pobierać aktualizacje.' 'Warning' }; exit 0 }
$repo = (Get-Content $repoFile -Raw).Trim()
$headers = @{ 'User-Agent' = 'Wymiary-updater'; 'Accept' = 'application/vnd.github+json' }
try { $c = Invoke-RestMethod "https://api.github.com/repos/$repo/commits/main" -Headers $headers -TimeoutSec $Timeout }
catch { if (-not $Ask) { Say "Nie mogę sprawdzić aktualizacji na GitHubie ($repo).`n$($_.Exception.Message)" 'Warning' }; exit 0 }
$sha = $c.sha
$date = ([datetime]$c.commit.committer.date).ToString('yyyy.MM.dd')
$newVersion = "$date-$($sha.Substring(0, 7))"
$verFile = Join-Path $app 'version.txt'
$current = if (Test-Path $verFile) { (Get-Content $verFile -Raw).Trim() } else { '' }
if ($current -eq $newVersion) { if (-not $Ask) { Say "Masz najnowszą wersję: $current" }; exit 0 }

if ($Ask -and -not $Quiet) {
  $msg = "Na GitHubie jest nowa wersja gry:`n`n   $newVersion`n   $($c.commit.message.Split("`n")[0])`n`nTwoja wersja: $(if ($current) { $current } else { 'nieznana' })`n`nZaktualizować teraz?"
  if ([System.Windows.Forms.MessageBox]::Show($msg, 'Wymiary – aktualizacja', 'YesNo', 'Question') -ne 'Yes') { exit 0 }
}

$tmp = Join-Path $env:TEMP "wymiary-update-$($sha.Substring(0, 7))"
try {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force $tmp | Out-Null
  Invoke-WebRequest "https://codeload.github.com/$repo/zip/$sha" -OutFile "$tmp\src.zip" -UseBasicParsing -TimeoutSec 120
  Expand-Archive "$tmp\src.zip" "$tmp\src" -Force
  $root = Get-ChildItem "$tmp\src" -Directory | Select-Object -First 1
  foreach ($item in 'index.html', 'README.md', 'Zainstaluj.cmd', 'assets', 'js', 'server', 'launcher', 'installer') {
    $from = Join-Path $root.FullName $item
    if (Test-Path $from) { Copy-Item $from $app -Recurse -Force }
  }
  Set-Content $verFile $newVersion -Encoding ASCII
  Say "Gra zaktualizowana do wersji $newVersion."
} catch {
  Say "Aktualizacja nie powiodła się:`n$($_.Exception.Message)" 'Error'
} finally {
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
