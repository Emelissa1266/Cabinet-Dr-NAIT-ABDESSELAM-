$ErrorActionPreference = "Stop"

$script:ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$script:ComposeFile = Join-Path $ProjectRoot "compose.production.yaml"
$script:EnvironmentFile = if ($env:CLINIC_PRODUCTION_ENV_FILE) {
    [System.IO.Path]::GetFullPath($env:CLINIC_PRODUCTION_ENV_FILE)
} else {
    Join-Path $ProjectRoot "server\.env.production"
}
$env:PRODUCTION_ENV_FILE = $EnvironmentFile.Replace("\", "/")
$script:ComposeArguments = @("compose", "--env-file", $EnvironmentFile, "-f", $ComposeFile)

function Assert-ProductionEnvironment {
    if (-not (Test-Path -LiteralPath $EnvironmentFile -PathType Leaf)) {
        throw "Missing $EnvironmentFile. Run Initialize-Production.ps1 first."
    }
}

function Invoke-ClinicCompose {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    & docker @ComposeArguments @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose failed with exit code $LASTEXITCODE."
    }
}

function Get-ProductionValue {
    param([Parameter(Mandatory = $true)][string]$Name)
    Assert-ProductionEnvironment
    $line = Get-Content -LiteralPath $EnvironmentFile | Where-Object { $_ -match "^$([regex]::Escape($Name))=" } | Select-Object -Last 1
    if (-not $line) { return $null }
    return $line.Substring($line.IndexOf("=") + 1)
}

function Wait-DockerEngine {
    param([int]$TimeoutSeconds = 180)
    & docker info *> $null
    if ($LASTEXITCODE -eq 0) { return }

    Write-Host "Starting Docker Desktop..."
    & docker desktop start *> $null
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 5
        & docker info *> $null
        if ($LASTEXITCODE -eq 0) { return }
    }
    throw "Docker Desktop did not become ready within $TimeoutSeconds seconds."
}
