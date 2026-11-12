#!/usr/bin/env bash
set -e

echo "Seeding TalentOS database..."
docker compose exec backend npm run seed

