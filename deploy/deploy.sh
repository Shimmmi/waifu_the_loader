#!/usr/bin/env bash
# Деплой на VPS: ./deploy/deploy.sh  (из корня репозитория, под root или пользователем в группе docker)
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "Нет .env — скопируйте .env.example и заполните"; exit 1; }
COMPOSE="docker compose --env-file .env -f deploy/docker-compose.yml"

if [ "${SKIP_PULL:-0}" != "1" ] && git remote get-url origin >/dev/null 2>&1; then
  git pull --ff-only
fi

mkdir -p data/portraits data/www
# Контейнеры работают от пользователя node (uid 1000)
chown -R 1000:1000 data/portraits

$COMPOSE build app
$COMPOSE up -d postgres redis
$COMPOSE up -d app worker

# Статика клиента из образа → data/www (её раздаёт Nginx)
cid=$(docker create waifu_loader:latest)
rm -rf data/www.new && docker cp "$cid:/app/client/dist" data/www.new && docker rm "$cid" >/dev/null
rm -rf data/www.old && { [ -d data/www ] && mv data/www data/www.old || true; } && mv data/www.new data/www && rm -rf data/www.old

echo "Ждём API…"
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8040/waifu_loader/api/health >/dev/null 2>&1; then
    curl -fsS http://127.0.0.1:8040/waifu_loader/api/health; echo
    break
  fi
  sleep 2
done

if nginx -t 2>/dev/null; then
  systemctl reload nginx && echo "nginx reloaded"
else
  echo "⚠️  nginx -t не прошёл — nginx не перезагружен"
fi
echo "✅ Готово: https://shimmirpgbot.ru/waifu_loader/"
