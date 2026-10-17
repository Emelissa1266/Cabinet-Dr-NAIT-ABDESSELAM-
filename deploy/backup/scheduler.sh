#!/bin/sh
set -eu

mkdir -p /status
interval_hours="${BACKUP_DATABASE_INTERVAL_HOURS:-6}"
daily_hour="${BACKUP_DAILY_HOUR:-2}"
poll_seconds="${BACKUP_SCHEDULER_POLL_SECONDS:-300}"

case "$interval_hours" in
  ''|*[!0-9]*) echo "BACKUP_DATABASE_INTERVAL_HOURS must be a positive integer." >&2; exit 2 ;;
esac
if [ "$interval_hours" -le 0 ]; then
  echo "BACKUP_DATABASE_INTERVAL_HOURS must be greater than zero." >&2
  exit 2
fi

while true; do
  epoch="$(date +%s)"
  slot="$((epoch / (interval_hours * 3600)))"
  day="$(date +%Y-%m-%d)"
  hour="$(date +%H)"
  hour="${hour#0}"
  hour="${hour:-0}"
  last_slot="$(cat /status/database-slot 2>/dev/null || true)"
  last_daily="$(cat /status/daily-day 2>/dev/null || true)"

  if [ "$hour" -ge "$daily_hour" ] && [ "$last_daily" != "$day" ]; then
    if /opt/clinic/backup.sh daily; then
      printf '%s\n' "$day" > /status/daily-day
      printf '%s\n' "$slot" > /status/database-slot
    fi
  elif [ "$last_slot" != "$slot" ]; then
    if /opt/clinic/backup.sh database; then
      printf '%s\n' "$slot" > /status/database-slot
    fi
  fi

  sleep "$poll_seconds"
done
