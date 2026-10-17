[CmdletBinding()]
param(
    [string]$Snapshot = "latest",
    [string]$TargetDatabase = "clinic_restore_validation",
    [switch]$Live,
    [string]$ConfirmLiveRestore = ""
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Common.ps1")
Assert-ProductionEnvironment
Wait-DockerEngine

$liveDatabase = Get-ProductionValue "POSTGRES_DB"
if (-not $Live) {
    if ($TargetDatabase -eq $liveDatabase) {
        throw "Use a different TargetDatabase for a validation restore."
    }
    Invoke-ClinicCompose --profile tools run --rm restore restore $Snapshot $TargetDatabase staged database-only
    Write-Host "Validation restore completed in database '$TargetDatabase'. Live data was not changed."
    exit 0
}

if ($ConfirmLiveRestore -ne "RESTORE $liveDatabase") {
    throw "Live restore refused. Re-run with -ConfirmLiveRestore 'RESTORE $liveDatabase'."
}

Invoke-ClinicCompose stop proxy frontend backend scheduler backup
try {
    Invoke-ClinicCompose --profile tools run --rm restore restore $Snapshot $liveDatabase allow-live with-files
} catch {
    Write-Error "Live restore failed. Application writers remain stopped for investigation. Database service is still running."
    throw
}
Invoke-ClinicCompose up --detach backend scheduler frontend proxy backup
Write-Host "Guarded live restore completed and services restarted."
