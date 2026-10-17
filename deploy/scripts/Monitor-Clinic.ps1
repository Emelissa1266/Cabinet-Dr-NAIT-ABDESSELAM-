[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Common.ps1")

try {
    Assert-ProductionEnvironment
    & docker info *> $null
    if ($LASTEXITCODE -ne 0) { throw "Docker engine is unavailable." }

    $hostname = Get-ProductionValue "LAN_HOSTNAME"
    $response = Invoke-RestMethod -Uri "https://$hostname/api/v1/health/" -TimeoutSec 15
    if ($response.status -ne "ok") { throw "Clinic health endpoint is unhealthy." }

    $databaseStatus = Join-Path $ProjectRoot "deploy\runtime\backup-status\last-database.json"
    $dailyStatus = Join-Path $ProjectRoot "deploy\runtime\backup-status\last-daily.json"
    $available = @($databaseStatus, $dailyStatus) | Where-Object { Test-Path -LiteralPath $_ }
    if (-not $available) { throw "No successful backup status has been recorded." }
    $latest = $available | ForEach-Object { Get-Content -Raw -LiteralPath $_ | ConvertFrom-Json } |
        Sort-Object { [datetime]$_.completed_at } -Descending | Select-Object -First 1
    if ($latest.status -ne "ok") { throw "The latest backup attempt failed." }
    if (([datetime]::UtcNow - [datetime]$latest.completed_at).TotalHours -gt 8) {
        throw "No successful database backup has completed in the last 8 hours."
    }
} catch {
    Write-EventLog -LogName Application -Source ClinicManagement -EntryType Error `
        -EventId 100 -Message $_.Exception.Message
    throw
}
