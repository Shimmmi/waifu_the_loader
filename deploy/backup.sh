#!/usr/bin/env bash
# Ежедневный бэкап (ТЗ 0.2): дамп PostgreSQL + архив портретов, хранится 7 последних копий.
# Cron (root): 30 4 * * * /opt/Waifu_Loader/deploy/backup.sh >> /var/log/waifu_loader_backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."
DEST=${BACKUP_DIR:-/var/backups/waifu_loader}
KEEP=${BACKUP_KEEP:-7}
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p "$DEST"

set -a; . ./.env; set +a
docker compose --env-file .env -f deploy/docker-compose.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom > "$DEST/db-$TS.dump"
tar -czf "$DEST/portraits-$TS.tar.gz" -C data portraits

ls -1t "$DEST"/db-*.dump | tail -n +$((KEEP + 1)) | xargs -r rm -f
ls -1t "$DEST"/portraits-*.tar.gz | tail -n +$((KEEP + 1)) | xargs -r rm -f
echo "$(date -Is) backup ok: $DEST/db-$TS.dump"
