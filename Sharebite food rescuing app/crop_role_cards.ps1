Add-Type -AssemblyName System.Drawing
$srcPath = 'C:\Users\Anubhav\.gemini\antigravity-ide\brain\559950d7-6a42-4e9e-ba10-425827bc6b1b\.user_uploaded\media_1792592214897.jpg'
$src = [System.Drawing.Bitmap]::FromFile($srcPath)

# 1. Donor bottom illustration
$rectDonor = New-Object System.Drawing.Rectangle(42, 516, 296, 160)
$cropDonor = $src.Clone($rectDonor, $src.PixelFormat)
$cropDonor.Save('src\assets\role_donor_illus.png', [System.Drawing.Imaging.ImageFormat]::Png)
$cropDonor.Dispose()

# 2. Acceptor / NGO bottom illustration
$rectNgo = New-Object System.Drawing.Rectangle(362, 516, 298, 160)
$cropNgo = $src.Clone($rectNgo, $src.PixelFormat)
$cropNgo.Save('src\assets\role_acceptor_illus.png', [System.Drawing.Imaging.ImageFormat]::Png)
$cropNgo.Dispose()

# 3. Rider bottom illustration
$rectRider = New-Object System.Drawing.Rectangle(680, 516, 298, 160)
$cropRider = $src.Clone($rectRider, $src.PixelFormat)
$cropRider.Save('src\assets\role_rider_illus.png', [System.Drawing.Imaging.ImageFormat]::Png)
$cropRider.Dispose()

$src.Dispose()
Write-Host "ROLE ILLUSTRATIONS CROPPED CLEANLY"
