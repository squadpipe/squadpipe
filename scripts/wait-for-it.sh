#!/usr/bin/env bash
# wait-for-it.sh: Wait for TCP host/port to be available
TIMEOUT=15
HOST=""
PORT=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    *:* )
      HOST=$(echo $1 | cut -d: -f1)
      PORT=$(echo $1 | cut -d: -f2)
      shift 1
      ;;
    -t)
      TIMEOUT="$2"
      shift 2
      ;;
    *)
      shift 1
      ;;
  esac
done

if [ -z "$HOST" ] || [ -z "$PORT" ]; then
  echo "Usage: wait-for-it.sh host:port [-t timeout]"
  exit 1
fi

echo "Waiting up to ${TIMEOUT}s for TCP connection to ${HOST}:${PORT}..."
for i in $(seq $TIMEOUT); do
  nc -z "$HOST" "$PORT" > /dev/null 2>&1
  result=$?
  if [ $result -eq 0 ]; then
    echo "Connection to ${HOST}:${PORT} established!"
    exit 0
  fi
  sleep 1
done

echo "Operation timed out waiting for ${HOST}:${PORT}"
exit 1

