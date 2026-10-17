[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Common.ps1")
Assert-ProductionEnvironment
Wait-DockerEngine

$databaseQuery = "psql -U `$POSTGRES_USER -d `$POSTGRES_DB -Atc 'SELECT count(*) FROM django_migrations;'"
$before = (& docker @ComposeArguments exec -T database sh -c $databaseQuery).Trim()
if ($LASTEXITCODE -ne 0 -or $before -notmatch '^\d+$') { throw "Could not read the migration marker before recreation." }

Invoke-ClinicCompose up --detach --force-recreate database
$deadline = (Get-Date).AddMinutes(2)
do {
    Start-Sleep -Seconds 3
    $health = (& docker @ComposeArguments ps --format json database | ConvertFrom-Json).Health
} while ($health -ne "healthy" -and (Get-Date) -lt $deadline)
if ($health -ne "healthy") { throw "Database did not become healthy after recreation." }

$after = (& docker @ComposeArguments exec -T database sh -c $databaseQuery).Trim()
if ($before -ne $after) { throw "Persistence check failed: migration marker changed after container recreation." }
Invoke-ClinicCompose up --detach
Write-Host "Database persistence passed ($before migration records before and after container recreation)."
