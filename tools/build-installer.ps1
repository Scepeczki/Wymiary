# Builds the installers into dist\ (uses IExpress, which is part of Windows):
#   dist\Wymiary-gra.exe          full: the game + Node.js (so the other player can also host)  ~ 40 MB
#   dist\Wymiary-nowa-wersja.exe  update only: the game files (install over an existing copy)  < 1 MB
# (Names avoid the words "install/setup/update": Windows would otherwise demand admin rights for them.)
#   powershell -ExecutionPolicy Bypass -File tools\build-installer.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'dist'
$stage = Join-Path $env:TEMP 'wymiary-build'
$node = (Get-Command node -ErrorAction Stop).Source
Remove-Item -Recurse -Force $stage -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $stage, $out | Out-Null

# PowerShell 5.1 reads scripts without a BOM as ANSI: make sure ours carry a UTF-8 BOM (Polish characters)
foreach ($f in Get-ChildItem (Join-Path $root 'launcher'), (Join-Path $root 'installer') -Filter *.ps1) {
  $bytes = [IO.File]::ReadAllBytes($f.FullName)
  if (-not ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)) {
    [IO.File]::WriteAllText($f.FullName, [Text.Encoding]::UTF8.GetString($bytes), (New-Object Text.UTF8Encoding $true))
  }
}

# the distributed files = exactly what the game server offers to other players (server.js --manifest)
$manifest = & $node (Join-Path $root 'server\server.js') --manifest | ConvertFrom-Json
$version = $manifest.version
$app = Join-Path $stage 'app'
foreach ($f in $manifest.files) {
  $to = Join-Path $app ($f.p -replace '/', '\')
  New-Item -ItemType Directory -Force (Split-Path -Parent $to) | Out-Null
  Copy-Item (Join-Path $root ($f.p -replace '/', '\')) $to
}
Set-Content (Join-Path $app 'version.txt') $version -Encoding ASCII

function Build($name, [switch]$withNode, $friendly) {
  $dir = Join-Path $stage $name
  $payload = Join-Path $dir 'payload'
  New-Item -ItemType Directory -Force $payload | Out-Null
  Copy-Item -Recurse (Join-Path $app '*') $payload
  if ($withNode) { New-Item -ItemType Directory -Force (Join-Path $payload 'runtime') | Out-Null; Copy-Item $node (Join-Path $payload 'runtime\node.exe') }
  Compress-Archive -Path (Join-Path $payload '*') -DestinationPath (Join-Path $dir 'payload.zip') -CompressionLevel Optimal
  Copy-Item (Join-Path $root 'installer\install.ps1'), (Join-Path $root 'installer\install.cmd') $dir
  $target = Join-Path $out "$name.exe"
  $sed = @"
[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=0
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=%InstallPrompt%
DisplayLicense=%DisplayLicense%
FinishMessage=%FinishMessage%
TargetName=%TargetName%
FriendlyName=%FriendlyName%
AppLaunched=%AppLaunched%
PostInstallCmd=%PostInstallCmd%
AdminQuietInstCmd=%AdminQuietInstCmd%
UserQuietInstCmd=%UserQuietInstCmd%
SourceFiles=SourceFiles
[Strings]
InstallPrompt=
DisplayLicense=
FinishMessage=
TargetName=$target
FriendlyName=$friendly
AppLaunched=cmd /c install.cmd
PostInstallCmd=<None>
AdminQuietInstCmd=cmd /c install.cmd -Quiet
UserQuietInstCmd=cmd /c install.cmd -Quiet
FILE0="install.cmd"
FILE1="install.ps1"
FILE2="payload.zip"
[SourceFiles]
SourceFiles0=$dir\
[SourceFiles0]
%FILE0%=
%FILE1%=
%FILE2%=
"@
  $sedFile = Join-Path $dir "$name.sed"
  Set-Content $sedFile $sed -Encoding ASCII
  Remove-Item $target -ErrorAction SilentlyContinue
  # IExpress mis-parses quoted absolute SED paths: run it from the package folder with a relative name
  $p = Start-Process (Join-Path $env:SystemRoot 'System32\iexpress.exe') -ArgumentList '/N', '/Q', "$name.sed" -WorkingDirectory $dir -Wait -PassThru
  if (-not (Test-Path $target)) { throw "IExpress nie utworzył $target (kod $($p.ExitCode))" }
  '{0,-28} {1,8:N1} MB' -f "$name.exe", ((Get-Item $target).Length / 1MB)
}

"Wymiary $version"
Build 'Wymiary-gra' -withNode 'Wymiary (gra + serwer)'
Build 'Wymiary-nowa-wersja' 'Wymiary (nowa wersja)'
Set-Content (Join-Path $out 'wersja.txt') $version -Encoding ASCII
"Gotowe: $out"
