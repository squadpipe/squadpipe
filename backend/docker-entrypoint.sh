#!/bin/sh
set -e

if [ "${DB_LOCATION:-in_house}" = "external" ]; then
  if [ -n "${EXTERNAL_DATABASE_URL:-}" ]; then
    export DATABASE_URL="$EXTERNAL_DATABASE_URL"
  elif [ -n "${EXTERNAL_DB_HOST:-}" ]; then
    SSL_QUERY=""
    if [ "${EXTERNAL_DB_SSL:-false}" = "true" ]; then
      SSL_QUERY="?sslmode=require"
    fi
    export DATABASE_URL="postgresql://${EXTERNAL_DB_USER}:${EXTERNAL_DB_PASSWORD}@${EXTERNAL_DB_HOST}:${EXTERNAL_DB_PORT:-5432}/${EXTERNAL_DB_NAME}${SSL_QUERY}"
  fi
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
