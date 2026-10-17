[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
if (-not [System.Diagnostics.EventLog]::SourceExists("ClinicManagement")) {
    New-EventLog -LogName Application -Source "ClinicManagement"
}
$monitorScript = Join-Path $PSScriptRoot "Monitor-Clinic.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$monitorScript`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) `
    -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName "ClinicProductionHealthMonitor" -Action $action -Trigger $trigger `
    -Settings $settings -Description "Checks clinic availability and backup freshness every five minutes." `
    -RunLevel Highest -Force | Out-Null
Write-Host "Health monitor registered. Failures are written to the Windows Application event log."
