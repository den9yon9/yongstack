#!/bin/sh
# 单机定时备份: 每天全量 pg_dump, 保留 N 天, 写盘后立即 pg_restore --list 验证。
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_DIR:=/backups}"
: "${BACKUP_RETENTION_DAYS:=14}"
: "${BACKUP_INTERVAL_SECONDS:=86400}"

mkdir -p "$BACKUP_DIR"

while true; do
  timestamp=$(date +%Y%m%d-%H%M%S)
  file="$BACKUP_DIR/yongstack-$timestamp.dump"
  echo "[backup] dumping to $file"
  if pg_dump --format=custom --no-owner --no-acl --file "$file" "$DATABASE_URL"; then
    if pg_restore --list "$file" >/dev/null; then
      echo "[backup] verified $file"
      find "$BACKUP_DIR" -name 'yongstack-*.dump' -type f -mtime +"$BACKUP_RETENTION_DAYS" -delete
    else
      echo "[backup] verification failed, removing $file" >&2
      rm -f "$file"
    fi
  else
    echo "[backup] dump failed" >&2
    rm -f "$file"
  fi
  sleep "$BACKUP_INTERVAL_SECONDS"
done
