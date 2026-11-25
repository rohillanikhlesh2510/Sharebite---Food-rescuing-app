Add-Type -AssemblyName System.Drawing
$srcPath = 'C:\Users\Anubhav\.gemini\antigravity-ide\brain\3ece4c6d-b65e-4703-a3a6-25f3e8ed741b\.user_uploaded\media_1789395213464.jpg'
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

# Food sharing photo with wavy arch, hands, food, and glassmorphic stats bar:
# From x=0 to x=560, y=348 to y=640 (width = 560, height = 292)
$rect = New-Object System.Drawing.Rectangle(0, 348, 560, 292)
$crop = $src.Clone($rect, $src.PixelFormat)
$crop.Save('src\assets\auth_food_sharing.png', [System.Drawing.Imaging.ImageFormat]::Png)
$crop.Dispose()

$src.Dispose()
Write-Host 'AUTH PHOTO CROPPED PRECISELY'
