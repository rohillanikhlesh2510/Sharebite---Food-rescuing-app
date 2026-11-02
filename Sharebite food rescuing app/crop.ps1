Add-Type -AssemblyName System.Drawing
$srcPath = 'C:\Users\Anubhav\.gemini\antigravity-ide\brain\3ece4c6d-b65e-4703-a3a6-25f3e8ed741b\.user_uploaded\media_1789394295765.jpg'
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

# Entire right hero block:
# From x=625 to x=1024 (width = 399), y=65 to y=455 (height = 390)
$rect = New-Object System.Drawing.Rectangle(625, 65, 399, 390)
$crop = $src.Clone($rect, $src.PixelFormat)
$crop.Save('src\assets\hero_boy_exact.png', [System.Drawing.Imaging.ImageFormat]::Png)
$crop.Dispose()

# Also let's crop the top left botanical leaf:
# From x=0 to x=60, y=80 to y=200
$rectLeaf1 = New-Object System.Drawing.Rectangle(0, 85, 55, 120)
$cropLeaf1 = $src.Clone($rectLeaf1, $src.PixelFormat)
$cropLeaf1.Save('src\assets\leaf_top_left.png', [System.Drawing.Imaging.ImageFormat]::Png)
$cropLeaf1.Dispose()

# Bottom left botanical leaf:
# From x=0 to x=60, y=360 to y=520
$rectLeaf2 = New-Object System.Drawing.Rectangle(0, 360, 55, 140)
$cropLeaf2 = $src.Clone($rectLeaf2, $src.PixelFormat)
$cropLeaf2.Save('src\assets\leaf_bottom_left.png', [System.Drawing.Imaging.ImageFormat]::Png)
$cropLeaf2.Dispose()

$src.Dispose()
Write-Host 'SUCCESS CROPPED ALL'
