#!/bin/bash
# cloudflare-setup.sh — legt Tunnel + DNS + Access-App via Cloudflare-API an
# und gibt den Tunnel-Token aus (für provision.sh / cloudflared service install).
#
#   source deploy/.env && bash deploy/cloudflare-setup.sh
#
# Benötigt in .env: CF_API_TOKEN, CF_DOMAIN, CF_SUBDOMAIN, CF_TUNNEL_NAME, CF_ACCESS_EMAILS
set -euo pipefail
: "${CF_API_TOKEN:?}"; : "${CF_DOMAIN:?}"; : "${CF_SUBDOMAIN:?}"
CF_TUNNEL_NAME="${CF_TUNNEL_NAME:-notes-app}"
HOST="$CF_SUBDOMAIN.$CF_DOMAIN"
API="https://api.cloudflare.com/client/v4"
auth=(-H "Authorization: Bearer $CF_API_TOKEN" -H "Content-Type: application/json")
jget() { grep -oE "\"$1\":\"[^\"]*\"" | head -1 | cut -d'"' -f4; }

echo "=== Account + Zone ermitteln ==="
ZONE_JSON=$(curl -s "${auth[@]}" "$API/zones?name=$CF_DOMAIN")
ZONE_ID=$(echo "$ZONE_JSON" | jget id)
ACCOUNT_ID=$(echo "$ZONE_JSON" | grep -oE '"account":\{"id":"[^"]*"' | head -1 | cut -d'"' -f6)
echo "  zone=$ZONE_ID account=$ACCOUNT_ID host=$HOST"

echo "=== Tunnel anlegen ==="
TUN_JSON=$(curl -s -X POST "${auth[@]}" "$API/accounts/$ACCOUNT_ID/cfd_tunnel" \
  -d "{\"name\":\"$CF_TUNNEL_NAME\",\"config_src\":\"cloudflare\"}")
TUNNEL_ID=$(echo "$TUN_JSON" | jget id)
echo "  tunnel_id=$TUNNEL_ID"

echo "=== Tunnel-Token holen ==="
TUNNEL_TOKEN=$(curl -s "${auth[@]}" "$API/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/token" | grep -oE '"result":"[^"]*"' | cut -d'"' -f4)

echo "=== Ingress konfigurieren ($HOST -> http://localhost:3000) ==="
curl -s -X PUT "${auth[@]}" "$API/accounts/$ACCOUNT_ID/cfd_tunnel/$TUNNEL_ID/configurations" \
  -d "{\"config\":{\"ingress\":[{\"hostname\":\"$HOST\",\"service\":\"http://localhost:3000\"},{\"service\":\"http_status:404\"}]}}" >/dev/null

echo "=== DNS CNAME anlegen ==="
curl -s -X POST "${auth[@]}" "$API/zones/$ZONE_ID/dns_records" \
  -d "{\"type\":\"CNAME\",\"name\":\"$CF_SUBDOMAIN\",\"content\":\"$TUNNEL_ID.cfargotunnel.com\",\"proxied\":true,\"ttl\":1}" >/dev/null

if [ -n "${CF_ACCESS_EMAILS:-}" ]; then
  echo "=== Access-App + Policy (Google-Login + erlaubte E-Mails) ==="
  GOOGLE_IDP=$(curl -s "${auth[@]}" "$API/accounts/$ACCOUNT_ID/access/identity_providers" | grep -oE '"id":"[^"]*","[^}]*"type":"google"' | head -1 | cut -d'"' -f4)
  INCLUDES=$(echo "$CF_ACCESS_EMAILS" | tr ',' '\n' | sed 's/^ *//;s/ *$//' | while read -r e; do [ -n "$e" ] && printf '{"email":{"email":"%s"}},' "$e"; done | sed 's/,$//')
  IDP_PART=""; [ -n "$GOOGLE_IDP" ] && IDP_PART="\"allowed_idps\":[\"$GOOGLE_IDP\"],\"auto_redirect_to_identity\":true,"
  curl -s -X POST "${auth[@]}" "$API/accounts/$ACCOUNT_ID/access/apps" \
    -d "{\"name\":\"Notizen\",\"type\":\"self_hosted\",\"domain\":\"$HOST\",\"self_hosted_domains\":[\"$HOST\"],\"session_duration\":\"24h\",$IDP_PART\"policies\":[{\"name\":\"Erlaubte User\",\"decision\":\"allow\",\"include\":[$INCLUDES]}]}" >/dev/null
fi

echo
echo "=== FERTIG ==="
echo "TUNNEL_TOKEN (für provision.sh CLOUDFLARE_TUNNEL_TOKEN oder 'cloudflared service install <token>'):"
echo "$TUNNEL_TOKEN"
