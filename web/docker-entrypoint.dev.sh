#!/bin/sh
set -e
if [ ! -d node_modules/react ]; then
  npm ci
fi
exec npm run dev -- --host 0.0.0.0 --port 5173
