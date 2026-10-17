#!/bin/sh
set -eu
umask 077

snapshot="${1:-latest}"
target_database="${2:-clinic_restore_validation}"
mode="${3:-staged}"
restore_files="${4:-database-only}"

case "$snapshot" in -*) echo "Invalid snapshot identifier." >&2; exit 2 ;; esac
case "$target_database" in ''|*[!a-zA-Z0-9_]*) echo "Invalid target database name." >&2; exit 2 ;; esac

if [ "$target_database" = "$PGDATABASE" ] && [ "$mode" != "allow-live" ]; then
  echo "Refusing to overwrite the live database without the allow-live guard." >&2
  exit 3
fi
if [ "$restore_files" = "with-files" ] && [ "$target_database" != "$PGDATABASE" ]; then
  echo "File restoration is only valid during an explicitly guarded live restore." >&2
  exit 3
fi

find /restore -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
restic check
restic restore "$snapshot" --target /restore
dump_file="$(find /restore -type f -name 'clinic-db-*.dump' | sort | tail -n 1)"
if [ -z "$dump_file" ]; then
  echo "No PostgreSQL dump exists in snapshot $snapshot." >&2
  exit 4
fi

if psql --dbname postgres --tuples-only --no-align --command "SELECT 1 FROM pg_database WHERE datname = '$target_database'" | grep -q 1; then
  if [ "$mode" != "allow-live" ]; then
    echo "Target database already exists: $target_database" >&2
    exit 5
  fi
  psql --dbname postgres --set ON_ERROR_STOP=1 --command \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$target_database' AND pid <> pg_backend_pid()"
  dropdb "$target_database"
fi

createdb --owner "$APP_DB_USER" "$target_database"
pg_restore \
  --exit-on-error \
  --no-owner \
  --role "$APP_DB_USER" \
  --dbname "$target_database" \
  "$dump_file"

if [ "$restore_files" = "with-files" ]; then
  find /live/private_media -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
  cp -a /restore/source/private_media/. /live/private_media/
  chown -R 10001:10001 /live/private_media

  find /live/caddy_data -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +
  cp -a /restore/source/caddy_data/. /live/caddy_data/
fi

echo "Restore completed: snapshot=${snapshot} database=${target_database} files=${restore_files}"
