# Production installation

This package runs the clinic application on one Windows PC and exposes only HTTPS ports 80/443 to the authorized cabinet LAN. PostgreSQL, Django, Next.js, reminders, and backup processes are not published to the LAN.

## Before installation

1. Use a supported Windows 11 Pro or Enterprise host with virtualization enabled and at least 16 GB RAM, an SSD for application data, and a separate encrypted backup disk.
2. Reserve a static IPv4 address for the server in the router/DHCP configuration. The examples below use `192.168.1.20` and LAN `192.168.1.0/24`.
3. Enable BitLocker on the Windows system drive and the backup drive. Store recovery keys outside the server PC.
4. Install Docker Desktop in all-users mode with the WSL2 Linux-container backend. Complete its first launch while Internet is available. Review Docker's commercial licensing for the clinic's circumstances.
5. In Docker Desktop Settings, enable **Start Docker Desktop when you sign in**. Do not enable organization sign-in enforcement on an offline installation.
6. Copy this repository to a stable NTFS location such as `C:\Clinic\Cabinet-Dr-NAIT-ABDESSELAM`.

## Server installation

Open an elevated PowerShell window in the repository:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\deploy\scripts\Install-Clinic.ps1 `
  -ServerIp 192.168.1.20 `
  -LanCidr 192.168.1.0/24 `
  -BackupDestination E:\ClinicBackups `
  -LanHostname cabinet.local
```

The installer generates unique Django, PostgreSQL, application-role, and Restic secrets without printing them; restricts the environment file ACL; creates LAN-only firewall rules; builds and starts the services; installs the local CA certificate on the server; registers logon startup and health tasks; and creates the first encrypted backup.

It never runs `docker compose down -v`, drops a database, or imports/deletes existing medical data. If existing records must be migrated, make a verified source backup first and follow a rehearsed migration plan before staff use the new installation.

## Authorized workstations

Copy only `deploy\runtime\caddy-root.crt` to each authorized workstation through trusted removable media or an authenticated share. Never copy the Caddy private-key data directory.

Run elevated PowerShell on each workstation:

```powershell
Add-Content -LiteralPath "$env:SystemRoot\System32\drivers\etc\hosts" `
  -Value "192.168.1.20`t cabinet.local" -Encoding ascii
certutil.exe -addstore -f Root .\caddy-root.crt
```

Open `https://cabinet.local/login`. The browser must show a trusted HTTPS connection. Repeat for Doctor, Nurse, Secretary, and Administrator workstations.

## Routine commands

```powershell
.\deploy\scripts\Start-Clinic.ps1
.\deploy\scripts\Stop-Clinic.ps1
.\deploy\scripts\Verify-Clinic.ps1
.\deploy\scripts\Backup-Clinic.ps1 -Kind daily
.\deploy\scripts\Backup-Clinic.ps1 -Kind check
docker compose --env-file .\server\.env.production -f .\compose.production.yaml logs --tail 200
```

`Stop-Clinic.ps1` preserves every volume. Never add `-v` to a Compose down command.

## Internet independence

The running system uses no Google Fonts, CDN, cloud authentication, remote API, or hosted database. Images are pulled and application images are built during installation/update only. Before disconnecting Internet, export the complete image set:

```powershell
.\deploy\scripts\Export-OfflineImages.ps1
```

On a replacement offline server, load it with:

```powershell
docker load --input .\deploy\offline-images\clinic-production-images.tar
```

See [OFFLINE_LAN.md](OFFLINE_LAN.md), [OPERATIONS.md](OPERATIONS.md), and [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md) before handover.
