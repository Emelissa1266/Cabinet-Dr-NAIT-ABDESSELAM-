[CmdletBinding()]
param([ValidateSet("database", "daily", "check")][string]$Kind = "daily")

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Common.ps1")
Assert-ProductionEnvironment
Invoke-ClinicCompose exec -T backup /opt/clinic/backup.sh $Kind
