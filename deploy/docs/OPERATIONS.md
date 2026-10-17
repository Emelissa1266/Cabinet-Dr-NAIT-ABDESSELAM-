# Operations and maintenance

## Daily check

Run:

```powershell
.\deploy\scripts\Verify-Clinic.ps1
Get-WinEvent -FilterHashtable @{LogName='Application'; ProviderName='ClinicManagement'} -MaxEvents 20
```

Confirm every service is healthy, the login page opens over trusted HTTPS, the latest backup is successful, the backup disk has free space, and no clinic health-monitor error is present.

## Backups

The backup container creates:

- a PostgreSQL custom-format dump every 6 hours;
- one daily Restic snapshot containing a database dump, private documents/photos, production configuration, and Caddy CA state;
- a 5% repository data integrity read each day;
- retention of 30 days plus 12 monthly snapshots by default;
- status JSON under `deploy\runtime\backup-status` and failure details in container logs.

Change retention only in `server\.env.production`, then restart the backup service:

```powershell
docker compose --env-file .\server\.env.production -f .\compose.production.yaml up -d --force-recreate backup
```

The configured `BACKUP_DESTINATION` must remain separate from Docker's PostgreSQL volume. Use a UPS-protected, BitLocker-encrypted external drive or an encrypted NAS share with restricted credentials. Periodically rotate one encrypted backup copy off-site according to clinic policy.

## Safe update

Updates need Internet unless a validated offline image archive accompanies the release. First stage and review a known release; do not update directly from an unreviewed Git branch. From the release directory:

```powershell
.\deploy\scripts\Update-Clinic.ps1
.\deploy\scripts\Verify-Clinic.ps1
```

The update script creates a coordinated encrypted backup before building, applies migrations during backend start, and does not remove volumes. Afterward, test login/logout and one read-only workflow for all four roles before accepting the release.

## Startup and Windows logon

`ClinicProductionStartAtLogon` starts Docker Desktop and the Compose stack after the configured server operator signs in. `restart: unless-stopped` recovers containers only after the Docker engine itself is running.

Docker Desktop with WSL2 does not provide a guaranteed pre-logon Linux engine. For reliable unattended recovery, prefer either:

1. a small dedicated Linux server with Docker Engine enabled by systemd; or
2. an Ubuntu Hyper-V VM configured for automatic host-start and automatic Docker Engine startup.

Both alternatives avoid dependence on an interactive Windows session. Validate automatic startup after a real reboot before handover.

## Power recovery

Run once from elevated PowerShell:

```powershell
.\deploy\scripts\Configure-Power.ps1
```

In BIOS/UEFI, set **Restore on AC Power Loss** to **Power On** or **Last State**. This is hardware-specific. Software cannot power on a PC that remains fully shut down after power returns.

Use a line-interactive UPS sized for the PC, network switch/router, and backup disk. Configure graceful Windows shutdown before battery exhaustion, then test with clinic staff notified. Never perform the first power-loss test while patients are being served.

## Logs and monitoring

```powershell
docker compose --env-file .\server\.env.production -f .\compose.production.yaml logs --since 24h
Get-ScheduledTask -TaskName ClinicProductionStartAtLogon,ClinicProductionHealthMonitor
```

The health task runs every five minutes and records application or stale-backup failures in the Windows Application log. This is local reporting; without Internet or an on-site monitoring receiver, a person must review the server daily.
