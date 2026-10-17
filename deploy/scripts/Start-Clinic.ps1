[CmdletBinding()]
param([switch]$Build)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Common.ps1")
Assert-ProductionEnvironment
Wait-DockerEngine

$arguments = @("up", "--detach", "--remove-orphans")
if ($Build) { $arguments += "--build" }
Invoke-ClinicCompose @arguments
Invoke-ClinicCompose ps
