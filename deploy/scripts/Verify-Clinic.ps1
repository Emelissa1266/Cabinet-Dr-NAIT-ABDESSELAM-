[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Common.ps1")
Assert-ProductionEnvironment
Wait-DockerEngine

Invoke-ClinicCompose ps
$hostname = Get-ProductionValue "LAN_HOSTNAME"
$response = Invoke-RestMethod -Uri "https://$hostname/api/v1/health/" -TimeoutSec 15
if ($response.status -ne "ok") { throw "Application health endpoint did not return status=ok." }

$dailyStatus = Join-Path $ProjectRoot "deploy\runtime\backup-status\last-daily.json"
if (Test-Path -LiteralPath $dailyStatus) {
    $status = Get-Content -Raw -LiteralPath $dailyStatus | ConvertFrom-Json
    if ($status.status -ne "ok") { throw "The latest daily backup status is failed." }
    Write-Host "Latest daily backup: $($status.completed_at)"
} else {
    Write-Warning "No daily backup status exists yet. Run Backup-Clinic.ps1 before handover."
}
Write-Host "Application health check passed at https://$hostname"
