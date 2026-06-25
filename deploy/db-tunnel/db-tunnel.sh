#!/usr/bin/env bash
# db-tunnel.sh — öffnet einen lokalen Port zur entfernten PostgreSQL über einen
# Cloudflare-Tunnel. Die App verbindet sich danach gegen 127.0.0.1:<port>.
#
#   bash db-tunnel.sh <hostname> [local-port] [client-id] [client-secret]
#   bash db-tunnel.sh db.example.com 5432
#
# Voraussetzung: cloudflared installiert; serverseitig ist <hostname> als
# TCP-Ingress auf Postgres geroutet (siehe README.md).
set -euo pipefail

HOSTNAME="${1:?Hostname angeben, z.B. db.example.com}"
PORT="${2:-5432}"
CLIENT_ID="${3:-${CF_ACCESS_CLIENT_ID:-}}"
CLIENT_SECRET="${4:-${CF_ACCESS_CLIENT_SECRET:-}}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared fehlt. Installation: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/" >&2
  exit 1
fi

ARGS=(access tcp --hostname "$HOSTNAME" --url "127.0.0.1:$PORT")
if [ -n "$CLIENT_ID" ] && [ -n "$CLIENT_SECRET" ]; then
  ARGS+=(--service-token-id "$CLIENT_ID" --service-token-secret "$CLIENT_SECRET")
fi

echo "Tunnel: 127.0.0.1:$PORT  ->  $HOSTNAME  (Strg+C zum Beenden)"
echo "App-Verbindung: DB_HOST=127.0.0.1 DB_PORT=$PORT"
exec cloudflared "${ARGS[@]}"
