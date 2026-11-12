#!/usr/bin/env bash
set -e

echo "Running Prisma migrations..."
docker compose exec backend npx prisma migrate dev

