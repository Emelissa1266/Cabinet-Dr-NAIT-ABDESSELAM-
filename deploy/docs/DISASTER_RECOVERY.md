# Disaster recovery

## Required recovery material

Keep these outside the main server:

- the encrypted Restic repository from `BACKUP_DESTINATION`;
- the Restic password and generated production environment in a clinic-controlled password vault and sealed encrypted recovery media;
- the validated release source and `clinic-production-images.tar`;
- BitLocker recovery keys;
- this guide, server static IP/subnet, and workstation inventory.

The Caddy root private key is inside the encrypted daily backup. Preserving it avoids reinstalling a new CA on every workstation after recovery.

## Monthly restore rehearsal

With services running, restore the latest snapshot into a non-production database:

```powershell
.\deploy\scripts\Restore-Clinic.ps1 `
  -Snapshot latest `
  -TargetDatabase clinic_restore_validation_202610
```

Then inspect it without exposing it to staff clients:

```powershell
docker compose --env-file .\server\.env.production -f .\compose.production.yaml `
  exec -T database psql -U clinic_backup_admin -d clinic_restore_validation_202610 `
  -c "SELECT count(*) FROM django_migrations;"
```

Record date, snapshot ID, row-count checks, sample file checksums, tester, and outcome. Delete rehearsal databases only after the result has been documented and a second person confirms the exact database name.

## Guarded live restore

A live restore replaces the clinic database, private media, and Caddy CA state. Confirm the chosen snapshot and take an additional copy of current storage first. Then run:

```powershell
.\deploy\scripts\Restore-Clinic.ps1 `
  -Snapshot latest `
  -Live `
  -ConfirmLiveRestore "RESTORE clinic_db"
```

The script stops application writers, requires the exact confirmation phrase, restores files and database, and restarts services only after success. On failure it leaves application writers stopped for investigation.

## Replacement server sequence

1. Configure BIOS power recovery, Windows, static IP, BitLocker, UPS, Docker Desktop, and the application directory.
2. Load the offline image archive with `docker load` if Internet is unavailable.
3. Restore `server\.env.production` from the independent recovery copy and restrict its NTFS ACL.
4. Attach the encrypted backup storage at the same `BACKUP_DESTINATION` path.
5. Start only the database:

```powershell
docker compose --env-file .\server\.env.production -f .\compose.production.yaml up -d database
```

6. Perform the guarded live restore, then run `Verify-Clinic.ps1`.
7. Confirm Caddy certificate trust, all four roles, private images/documents, invoices, PDFs, payments, and printer output before reopening the clinic.

Never use `docker compose down -v`, delete Docker Desktop data, or initialize a new Restic repository over an existing backup path during recovery.
