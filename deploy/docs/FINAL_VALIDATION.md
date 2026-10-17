# Final validation matrix

## Automated in the development workspace

- Django checks, migrations check, Ruff, complete PostgreSQL pytest suite, dependency audit.
- TypeScript, ESLint, frontend unit tests, and Next.js production build.
- Compose interpolation/config validation and PowerShell/shell script parsing.
- Container image builds and health checks when the Docker engine is available.
- Non-production PostgreSQL restore test when the production stack is available.

## Required on the target PC

- Static-IP and DHCP-reservation test.
- Trusted HTTPS from every authorized workstation.
- Windows Firewall verification from cabinet and guest networks.
- Doctor, Nurse, Secretary, and Administrator concurrent browser sessions.
- Synthetic patient creation; consultation; care assignment; photo/document upload and retrieval; prescription, work-leave, and invoice PDF printing; invoice/payment/receipt; role-denial checks; concurrent financial action.
- Database container recreation with `Test-DatabasePersistence.ps1`.
- Encrypted backup creation, repository integrity check, and staged restore with sample media checksums.
- WAN-disconnected operation for a complete working period.
- Windows reboot and startup-task recovery.
- Controlled UPS shutdown and BIOS/UEFI AC-return recovery.
- Printer/scanner and browser compatibility.

Deployment is not complete until every target-PC item is recorded with date, operator, workstation, expected result, and actual result.
