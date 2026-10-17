[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Run Configure-Power.ps1 from an elevated PowerShell window."
}

& powercfg.exe /change standby-timeout-ac 0
& powercfg.exe /change hibernate-timeout-ac 0
& powercfg.exe /change disk-timeout-ac 0
if ($LASTEXITCODE -ne 0) { throw "Windows power configuration failed." }
Write-Host "AC sleep, hibernation, and disk timeout are disabled. Battery behavior was not changed."
Write-Warning "Configure 'Restore on AC Power Loss' in BIOS/UEFI separately; Windows cannot power on a shut-down PC."
