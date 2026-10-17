[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ServerIp,
    [Parameter(Mandatory = $true)][string]$LanCidr,
    [Parameter(Mandatory = $true)][string]$BackupDestination,
    [string]$LanHostname = "cabinet.local"
)

$ErrorActionPreference = "Stop"
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run Install-Clinic.ps1 from an elevated PowerShell window."
}

. (Join-Path $PSScriptRoot "Common.ps1")
if (-not (Test-Path -LiteralPath $EnvironmentFile)) {
    & (Join-Path $PSScriptRoot "Initialize-Production.ps1") `
        -ServerIp $ServerIp -LanHostname $LanHostname -LanCidr $LanCidr `
        -BackupDestination $BackupDestination
}

& (Join-Path $PSScriptRoot "Configure-Firewall.ps1")
& (Join-Path $PSScriptRoot "Start-Clinic.ps1") -Build
& (Join-Path $PSScriptRoot "Install-Certificate.ps1") -MachineStore
& (Join-Path $PSScriptRoot "Register-StartupTask.ps1")
& (Join-Path $PSScriptRoot "Register-HealthMonitor.ps1")
& (Join-Path $PSScriptRoot "Backup-Clinic.ps1") -Kind daily
& (Join-Path $PSScriptRoot "Verify-Clinic.ps1")

Write-Host "Server-side installation completed. Client certificate and hostname setup remain manual."
