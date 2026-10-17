[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Common.ps1")
Assert-ProductionEnvironment
Wait-DockerEngine

Write-Host "Creating a coordinated backup before the update..."
Invoke-ClinicCompose exec -T backup /opt/clinic/backup.sh daily
Invoke-ClinicCompose build --pull
Invoke-ClinicCompose up --detach --remove-orphans
Invoke-ClinicCompose ps
Write-Host "Update applied. Run Verify-Clinic.ps1 and complete the role smoke test."
