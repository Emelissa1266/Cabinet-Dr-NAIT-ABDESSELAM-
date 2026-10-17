[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "Common.ps1")

$lanCidr = Get-ProductionValue "LAN_CIDR"
if (-not $lanCidr) { throw "LAN_CIDR is missing from the production environment." }

$allowName = "Clinic HTTPS from authorized LAN"
$blockName = "Clinic HTTPS blocked on public networks"

$allow = Get-NetFirewallRule -DisplayName $allowName -ErrorAction SilentlyContinue
if ($allow) {
    Set-NetFirewallRule -DisplayName $allowName -Enabled True -Action Allow -Profile Domain,Private
    Set-NetFirewallAddressFilter -AssociatedNetFirewallRule $allow -RemoteAddress $lanCidr
} else {
    New-NetFirewallRule -DisplayName $allowName -Direction Inbound -Action Allow -Protocol TCP `
        -LocalPort 80,443 -RemoteAddress $lanCidr -Profile Domain,Private | Out-Null
}

$block = Get-NetFirewallRule -DisplayName $blockName -ErrorAction SilentlyContinue
if ($block) {
    Set-NetFirewallRule -DisplayName $blockName -Enabled True -Action Block -Profile Public
} else {
    New-NetFirewallRule -DisplayName $blockName -Direction Inbound -Action Block -Protocol TCP `
        -LocalPort 80,443 -RemoteAddress Any -Profile Public | Out-Null
}

Write-Host "Windows Firewall allows ports 80/443 only from $lanCidr on private/domain profiles."
