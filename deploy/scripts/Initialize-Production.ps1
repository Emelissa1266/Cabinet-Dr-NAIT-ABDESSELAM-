[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ServerIp,
    [string]$LanHostname = "cabinet.local",
    [Parameter(Mandatory = $true)][string]$LanCidr,
    [Parameter(Mandatory = $true)][string]$BackupDestination
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Common.ps1")

$parsedIp = $null
if (-not [System.Net.IPAddress]::TryParse($ServerIp, [ref]$parsedIp) -or
    $parsedIp.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
    throw "ServerIp must be a valid static IPv4 address."
}
if ($LanHostname -notmatch '^[a-zA-Z0-9.-]+$') {
    throw "LanHostname contains invalid characters."
}

$template = Join-Path $ProjectRoot "server\.env.production.example"
if (Test-Path -LiteralPath $EnvironmentFile) {
    throw "$EnvironmentFile already exists. It was not overwritten."
}
if (-not (Test-Path -LiteralPath $template)) {
    throw "Missing production environment template: $template"
}

$backupPath = [System.IO.Path]::GetFullPath($BackupDestination)
$projectDrive = [System.IO.Path]::GetPathRoot($ProjectRoot)
$backupDrive = [System.IO.Path]::GetPathRoot($backupPath)
if ($projectDrive -eq $backupDrive) {
    throw "BackupDestination must be on separate storage from the application ($projectDrive)."
}
New-Item -ItemType Directory -Force -Path $backupPath | Out-Null

function New-RandomValue([int]$Length = 72) {
    $alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    $bytes = [byte[]]::new($Length)
    [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    -join ($bytes | ForEach-Object { $alphabet[$_ % $alphabet.Length] })
}

$values = @{
    "GENERATE_A_RANDOM_VALUE_OF_AT_LEAST_50_CHARACTERS" = New-RandomValue
    "GENERATE_A_RANDOM_DATABASE_ADMIN_PASSWORD" = New-RandomValue
    "GENERATE_A_DIFFERENT_RANDOM_APPLICATION_PASSWORD" = New-RandomValue
    "GENERATE_A_RANDOM_BACKUP_ENCRYPTION_PASSWORD" = New-RandomValue 88
    "LAN_HOSTNAME=cabinet.local" = "LAN_HOSTNAME=$LanHostname"
    "LAN_BIND_IP=0.0.0.0" = "LAN_BIND_IP=$ServerIp"
    "LAN_CIDR=192.168.1.0/24" = "LAN_CIDR=$LanCidr"
    "DJANGO_ALLOWED_HOSTS=cabinet.local" = "DJANGO_ALLOWED_HOSTS=$LanHostname,$ServerIp"
    "CORS_ALLOWED_ORIGINS=https://cabinet.local" = "CORS_ALLOWED_ORIGINS=https://$LanHostname"
    "CSRF_TRUSTED_ORIGINS=https://cabinet.local" = "CSRF_TRUSTED_ORIGINS=https://$LanHostname"
    "BACKUP_DESTINATION=E:/ClinicBackups" = "BACKUP_DESTINATION=$($backupPath.Replace('\', '/'))"
}

$content = Get-Content -Raw -LiteralPath $template
foreach ($entry in $values.GetEnumerator()) {
    $content = $content.Replace($entry.Key, $entry.Value)
}
[System.IO.File]::WriteAllText($EnvironmentFile, $content, [System.Text.UTF8Encoding]::new($false))
$currentAccount = "$env:USERDOMAIN\$env:USERNAME"
& icacls.exe $EnvironmentFile /inheritance:r /grant:r "$currentAccount`:(R,W)" "SYSTEM`:(F)" "*S-1-5-32-544`:(F)" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not restrict access to $EnvironmentFile." }

$hostsPath = Join-Path $env:SystemRoot "System32\drivers\etc\hosts"
$hostsEntry = "$ServerIp`t$LanHostname"
if (-not (Select-String -LiteralPath $hostsPath -Pattern "\s$([regex]::Escape($LanHostname))(\s|$)" -Quiet)) {
    Add-Content -LiteralPath $hostsPath -Value $hostsEntry -Encoding ascii
}

Write-Host "Production environment created without printing secrets."
Write-Host "Backup destination: $backupPath"
Write-Host "LAN URL: https://$LanHostname"
