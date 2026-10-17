[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Common.ps1")
Assert-ProductionEnvironment
Wait-DockerEngine

Invoke-ClinicCompose pull --ignore-buildable
Invoke-ClinicCompose build --pull
$imageDirectory = Join-Path $ProjectRoot "deploy\offline-images"
New-Item -ItemType Directory -Force -Path $imageDirectory | Out-Null
$archive = Join-Path $imageDirectory "clinic-production-images.tar"
$images = (& docker @ComposeArguments config --images | Sort-Object -Unique)
if ($LASTEXITCODE -ne 0 -or -not $images) { throw "Could not resolve production image names." }
& docker save --output $archive @images
if ($LASTEXITCODE -ne 0) { throw "Docker image export failed." }
Get-FileHash -Algorithm SHA256 -LiteralPath $archive | Format-List
Write-Host "Offline image archive created at $archive"
