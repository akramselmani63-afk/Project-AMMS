$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$project = Split-Path -Parent $PSScriptRoot
$source = Join-Path $project 'assets\amms-app-icon-green-a.png'
$icon = Join-Path $project 'assets\amms-app-icon.ico'
$sizes = @(256, 128, 64, 48, 32, 16)
$cropEdge = 55
$cropSize = 1144
$images = @()
    $original = [System.Drawing.Image]::FromFile($source)
    foreach ($size in $sizes) {
        $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $destination = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
        $graphics.DrawImage($original, $destination, $cropEdge, $cropEdge, $cropSize, $cropSize, [System.Drawing.GraphicsUnit]::Pixel)
        $stream = New-Object System.IO.MemoryStream
        $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
        $images += ,$stream.ToArray()
        $stream.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
    }
    foreach ($size in @(192, 512)) {
        $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $destination = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
        $graphics.DrawImage($original, $destination, $cropEdge, $cropEdge, $cropSize, $cropSize, [System.Drawing.GraphicsUnit]::Pixel)
        $bitmap.Save((Join-Path $project "assets\amms-pwa-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
        $graphics.Dispose(); $bitmap.Dispose()
    }
    $original.Dispose()
    $file = [System.IO.File]::Create($icon)
    $writer = New-Object System.IO.BinaryWriter($file)
    $writer.Write([UInt16]0); $writer.Write([UInt16]1); $writer.Write([UInt16]$sizes.Count)
    $offset = 6 + 16 * $sizes.Count
    for ($i = 0; $i -lt $sizes.Count; $i++) {
        $dimension = if ($sizes[$i] -eq 256) { [byte]0 } else { [byte]$sizes[$i] }
        $writer.Write($dimension); $writer.Write($dimension); $writer.Write([byte]0); $writer.Write([byte]0)
        $writer.Write([UInt16]1); $writer.Write([UInt16]32); $writer.Write([UInt32]$images[$i].Length); $writer.Write([UInt32]$offset)
        $offset += $images[$i].Length
    }
    foreach ($image in $images) { $writer.Write($image) }
    $writer.Dispose(); $file.Dispose()
Write-Output "Created $icon"
