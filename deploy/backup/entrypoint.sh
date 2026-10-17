#!/bin/sh
set -eu
umask 077

case "${1:-schedule}" in
  schedule)
    exec /opt/clinic/scheduler.sh
    ;;
  database|daily|check)
    exec /opt/clinic/backup.sh "$1"
    ;;
  restore)
    shift
    exec /opt/clinic/restore.sh "$@"
    ;;
  *)
    exec "$@"
    ;;
esac
