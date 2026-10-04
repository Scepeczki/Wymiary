# Generates assets/icon.png and assets/icon.ico (a tesseract projection) with System.Drawing.
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$assets = Join-Path $root 'assets'
New-Item -ItemType Directory -Force $assets | Out-Null

function Draw-Icon([int]$S) {
  $bmp = New-Object System.Drawing.Bitmap $S, $S
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  # rounded dark background
  $r = [single]($S * 0.2)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc(0, 0, $r, $r, 180, 90); $path.AddArc($S - $r - 1, 0, $r, $r, 270, 90)
  $path.AddArc($S - $r - 1, $S - $r - 1, $r, $r, 0, 90); $path.AddArc(0, $S - $r - 1, $r, $r, 90, 90)
  $path.CloseFigure()
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush (New-Object System.Drawing.Point 0, 0), (New-Object System.Drawing.Point $S, $S), ([System.Drawing.Color]::FromArgb(255, 40, 16, 80)), ([System.Drawing.Color]::FromArgb(255, 8, 12, 40))
  $g.FillPath($bg, $path)

  # tesseract: 16 vertices (+-1)^4, rotated in xw & zw, perspective 4D->3D->2D
  $a = 0.55; $b = 0.35; $c = 0.45
  $pts = @{}
  for ($i = 0; $i -lt 16; $i++) {
    $v = @(0..3 | ForEach-Object { if ($i -band (1 -shl $_)) { 1.0 } else { -1.0 } })
    $x = $v[0] * [math]::Cos($a) - $v[3] * [math]::Sin($a); $w = $v[0] * [math]::Sin($a) + $v[3] * [math]::Cos($a)
    $z = $v[2] * [math]::Cos($b) - $w * [math]::Sin($b); $w = $v[2] * [math]::Sin($b) + $w * [math]::Cos($b)
    $y = $v[1]
    $k = 1.0 / (2.6 - $w); $x *= $k; $y *= $k; $z *= $k
    $x2 = $x * [math]::Cos($c) - $z * [math]::Sin($c); $z2 = $x * [math]::Sin($c) + $z * [math]::Cos($c)
    $y2 = $y * [math]::Cos(0.35) - $z2 * [math]::Sin(0.35); $z3 = $y * [math]::Sin(0.35) + $z2 * [math]::Cos(0.35)
    $k2 = 1.0 / (2.2 - $z3)
    $pts[$i] = @(($x2 * $k2), (-$y2 * $k2), $w)
  }
  # fit into 78% of the icon, centered
  $xs = $pts.Values | ForEach-Object { $_[0] }; $ys = $pts.Values | ForEach-Object { $_[1] }
  $minX = ($xs | Measure-Object -Minimum).Minimum; $maxX = ($xs | Measure-Object -Maximum).Maximum
  $minY = ($ys | Measure-Object -Minimum).Minimum; $maxY = ($ys | Measure-Object -Maximum).Maximum
  $sc = 0.78 * $S / [math]::Max($maxX - $minX, $maxY - $minY)
  foreach ($key in @($pts.Keys)) { $p = $pts[$key]; $pts[$key] = @(($S / 2 + ($p[0] - ($minX + $maxX) / 2) * $sc), ($S / 2 + ($p[1] - ($minY + $maxY) / 2) * $sc), $p[2]) }
  $width = [single][math]::Max(1.2, $S / 48)
  for ($i = 0; $i -lt 16; $i++) {
    for ($d = 0; $d -lt 4; $d++) {
      $j = $i -bxor (1 -shl $d)
      if ($j -lt $i) { continue }
      $p = $pts[$i]; $q = $pts[$j]
      $t = (($p[2] + $q[2]) / 2 + 1.4) / 2.8; $t = [math]::Min(1, [math]::Max(0, $t))
      $col = [System.Drawing.Color]::FromArgb(255, [int](120 + 135 * $t), [int](220 - 140 * $t), 255)
      $pen = New-Object System.Drawing.Pen $col, $width
      $pen.StartCap = 'Round'; $pen.EndCap = 'Round'
      $g.DrawLine($pen, [single]$p[0], [single]$p[1], [single]$q[0], [single]$q[1])
    }
  }
  $g.Dispose()
  return $bmp
}

$sizes = @(256, 64, 48, 32, 16)
$pngs = @()
foreach ($s in $sizes) {
  $bmp = Draw-Icon $s
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  if ($s -eq 256) { $bmp.Save((Join-Path $assets 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png) }
  $pngs += , $ms.ToArray()
  $bmp.Dispose()
}

# ICO container with PNG-compressed entries
$fs = [System.IO.File]::Create((Join-Path $assets 'icon.ico'))
$bw = New-Object System.IO.BinaryWriter $fs
$bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $s = $sizes[$i]; $dim = if ($s -ge 256) { 0 } else { $s }
  $bw.Write([byte]$dim); $bw.Write([byte]$dim); $bw.Write([byte]0); $bw.Write([byte]0)
  $bw.Write([uint16]1); $bw.Write([uint16]32)
  $bw.Write([uint32]$pngs[$i].Length); $bw.Write([uint32]$offset)
  $offset += $pngs[$i].Length
}
foreach ($p in $pngs) { $bw.Write($p) }
$bw.Close()
Write-Output "Icon written to $assets"
