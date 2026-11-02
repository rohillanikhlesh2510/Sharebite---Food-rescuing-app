Add-Type -AssemblyName System.Drawing
$srcPath = 'C:\Users\Anubhav\.gemini\antigravity-ide\brain\559950d7-6a42-4e9e-ba10-425827bc6b1b\.user_uploaded\media_1792592214897.jpg'
$src = [System.Drawing.Bitmap]::FromFile($srcPath)
$w = $src.Width
$h = $src.Height
Write-Host "SOURCE DIMS: ${w}x${h}"
$src.Dispose()
