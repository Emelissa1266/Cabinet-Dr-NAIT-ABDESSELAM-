[CmdletBinding()]
param([switch]$MachineStore)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Common.ps1")
Assert-ProductionEnvironment
Wait-DockerEngine

$certificatePath = Join-Path $ProjectRoot "deploy\runtime\caddy-root.crt"
Invoke-ClinicCompose cp proxy:/data/caddy/pki/authorities/local/root.crt $certificatePath
$certificateArguments = @("-addstore", "-f")
if (-not $MachineStore) { $certificateArguments += "-user" }
$certificateArguments += @("Root", $certificatePath)
& certutil.exe @certificateArguments
if ($LASTEXITCODE -ne 0) { throw "Certificate installation failed." }
Write-Host "Caddy root certificate installed. Distribute only caddy-root.crt to authorized workstations."
