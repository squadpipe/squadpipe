#!/usr/bin/env bash
set -e

echo "Seeding SquadPipe database..."
docker compose exec backend npm run seed

