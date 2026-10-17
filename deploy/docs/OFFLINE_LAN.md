# Offline LAN and troubleshooting

## Network model

The server uses the stable name `cabinet.local`, a static IPv4 address, and Caddy's internal CA. Each authorized workstation resolves the hostname through clinic DNS or its Windows hosts file and trusts only the exported public root certificate. PostgreSQL and internal application ports are not reachable from the LAN.

## Offline acceptance test

After images, certificates, and backups are prepared:

1. Keep the cabinet switch/router powered but disconnect only the WAN/Internet uplink.
2. Reboot the server and complete the configured Windows operator sign-in when using Docker Desktop.
3. Run `Verify-Clinic.ps1` on the server.
4. From two staff PCs, open `https://cabinet.local/login` and exercise simultaneous workflows.
5. Generate an invoice PDF, prescription PDF, and work-leave PDF; upload and reopen a synthetic clinical image and document.
6. Confirm the six-hour database and daily backup status while WAN remains disconnected.
7. Reconnect WAN only after results are recorded.

## Diagnostic commands

```powershell
Resolve-DnsName cabinet.local
Test-NetConnection cabinet.local -Port 443
curl.exe -I https://cabinet.local/login
curl.exe https://cabinet.local/api/v1/health/
docker info
docker compose --env-file .\server\.env.production -f .\compose.production.yaml ps
docker compose --env-file .\server\.env.production -f .\compose.production.yaml logs --tail 200 proxy backend frontend
```

If name resolution fails, correct the hosts/DNS entry; do not switch users to the raw IP because secure cookies and CSRF trust are configured for the stable hostname. If HTTPS is untrusted, reinstall the exported `caddy-root.crt`; never bypass browser certificate warnings. If Docker is unavailable before logon, this is the documented Docker Desktop startup limitation, not a container restart-policy failure.

## LAN restriction checks

- Windows network profile must be Private or Domain, never Public for the trusted cabinet LAN.
- The inbound allow rule must contain the actual `LAN_CIDR` and only ports 80/443.
- Guest Wi-Fi must be isolated from the cabinet LAN.
- Disable router port forwarding and UPnP exposure for the server.
- Staff must not have Docker daemon access or Windows administrator accounts on the server.
