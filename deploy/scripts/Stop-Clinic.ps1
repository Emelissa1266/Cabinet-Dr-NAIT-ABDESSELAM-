[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Common.ps1")
Assert-ProductionEnvironment
Invoke-ClinicCompose stop
Write-Host "Clinic services stopped. Persistent volumes were preserved."
