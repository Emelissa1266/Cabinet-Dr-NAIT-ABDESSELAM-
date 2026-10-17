#!/bin/sh
set -eu
umask 077

kind="${1:-database}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump_file="/tmp/clinic-db-${timestamp}.dump"
status_file="/status/last-${kind}.json"

write_status() {
  state="$1"
  completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  mkdir -p /status
  printf '{"status":"%s","kind":"%s","completed_at":"%s"}\n' \
    "$state" "$kind" "$completed_at" > "${status_file}.tmp"
  mv "${status_file}.tmp" "$status_file"
}

fail() {
  code="$?"
  rm -f "$dump_file"
  write_status failed
  echo "Backup failed: kind=${kind} exit=${code}" >&2
  exit "$code"
}
trap fail INT TERM HUP EXIT

mkdir -p "$RESTIC_REPOSITORY" /status
if [ ! -f "$RESTIC_REPOSITORY/config" ]; then
  restic init
fi

case "$kind" in
  database)
    pg_dump --format=custom --compress=6 --file "$dump_file"
    restic backup "$dump_file" --host clinic-server --tag database
    ;;
  daily)
    pg_dump --format=custom --compress=6 --file "$dump_file"
    restic backup \
      "$dump_file" \
      /source/private_media \
      /source/config \
      /source/caddy_data \
      --host clinic-server \
      --tag daily
    restic check --read-data-subset=5%
    ;;
  check)
    restic check --read-data-subset=5%
    ;;
  *)
    echo "Unknown backup kind: $kind" >&2
    exit 2
    ;;
esac

if [ "$kind" != check ]; then
  restic forget \
    --tag "$kind" \
    --keep-within "${BACKUP_RETENTION_DAYS:-30}d" \
    --keep-monthly "${BACKUP_RETENTION_MONTHS:-12}" \
    --prune
fi

rm -f "$dump_file"
write_status ok
trap - INT TERM HUP EXIT
echo "Backup completed: kind=${kind} at=${timestamp}"
