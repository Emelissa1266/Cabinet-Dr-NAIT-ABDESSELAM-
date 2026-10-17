[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$startScript = Join-Path $PSScriptRoot "Start-Clinic.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$startScript`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 2) `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 20) -StartWhenAvailable
Register-ScheduledTask -TaskName "ClinicProductionStartAtLogon" -Action $action -Trigger $trigger `
    -Settings $settings -Description "Starts the clinic Docker stack after the server operator signs in." `
    -RunLevel Highest -Force | Out-Null
Write-Host "Startup task registered for user $env:USERNAME. It requires an interactive Windows sign-in."
