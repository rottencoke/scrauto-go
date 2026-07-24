#!/bin/sh
set -e

LOCK_HASH_FILE=node_modules/.package-lock-hash
CURRENT_HASH="$(sha256sum package-lock.json | awk '{print $1}')"

if [ ! -d node_modules ] || [ ! -f "$LOCK_HASH_FILE" ] || [ "$(cat "$LOCK_HASH_FILE")" != "$CURRENT_HASH" ]; then
  npm ci
  mkdir -p node_modules
  echo "$CURRENT_HASH" > "$LOCK_HASH_FILE"
fi

exec npm run dev -- --host 0.0.0.0 --port 5173
