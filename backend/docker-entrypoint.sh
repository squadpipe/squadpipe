#!/bin/sh
set -e

if [ -f "./dist/config/databaseUrl.js" ]; then
  export DATABASE_URL="$(node -e "process.stdout.write(require('./dist/config/databaseUrl').resolveDatabaseUrl())")"
elif [ -f "./src/config/databaseUrl.ts" ] && [ -x "./node_modules/.bin/tsx" ]; then
  export DATABASE_URL="$(./node_modules/.bin/tsx -e "import { resolveDatabaseUrl } from './src/config/databaseUrl'; process.stdout.write(resolveDatabaseUrl())")"
fi

ATTEMPT=1
MAX_ATTEMPTS=10
until npx prisma migrate deploy; do
  if [ "$ATTEMPT" -ge "$MAX_ATTEMPTS" ]; then
    echo "Failed to apply Prisma migrations after $MAX_ATTEMPTS attempts." >&2
    exit 1
  fi
  echo "Waiting for database before running Prisma migrations (attempt $ATTEMPT/$MAX_ATTEMPTS)..."
  ATTEMPT=$((ATTEMPT + 1))
  sleep 3
done

exec "$@"
