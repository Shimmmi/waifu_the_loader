#!/usr/bin/env bash
# Инвайты на проде: ./deploy/invite.sh create 5 "друзья" | list | admin <ник>
set -euo pipefail
cd "$(dirname "$0")/.."
exec docker compose --env-file .env -f deploy/docker-compose.yml exec -T app node dist/invite.js "$@"
