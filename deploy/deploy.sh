#!/usr/bin/env bash
# Update the production container from git: run on the server inside /opt/ai-coach
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
docker compose build ai-coach
docker compose up -d ai-coach
docker image prune -f >/dev/null
sleep 3
curl -fsS http://127.0.0.1:4010/api/health && echo " ✓ ai-coach up"
