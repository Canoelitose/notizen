#!/bin/bash
# provision.sh — Baut die komplette Notizen-App von Null auf einem Proxmox-Host.
#
# Voraussetzung: Repo auf den Proxmox-Host geklont, deploy/.env ausgefüllt.
#   git clone <repo> && cd notizen
#   cp deploy/.env.example deploy/.env && nano deploy/.env
#   bash deploy/provision.sh
#
# Idempotent genug für Wiederholung: existierende Container werden übersprungen.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$REPO_ROOT/deploy/.env" ] && source "$REPO_ROOT/deploy/.env"

# ── Konfiguration (Defaults, via .env überschreibbar) ─────────────────────────
WEB_CTID="${WEB_CTID:-104}"
DB_CTID="${DB_CTID:-105}"
WEB_IP="${WEB_IP:-10.10.11.104}"
DB_IP="${DB_IP:-10.10.11.105}"
CIDR="${CIDR:-23}"
GATEWAY="${GATEWAY:-10.10.10.1}"
BRIDGE="${BRIDGE:-vmbr0}"
STORAGE="${STORAGE:-local-lvm}"
NAMESERVER="${NAMESERVER:-1.1.1.1 9.9.9.9}"
TEMPLATE="${TEMPLATE:-debian-12-standard_12.12-1_amd64.tar.zst}"
DB_NAME="${DB_NAME:-notes_app}"
DB_USER="${DB_USER:-notes_app}"
CRED_DIR="/root/notes-app"
CRED_FILE="$CRED_DIR/credentials.txt"
CLOUDFLARE_TUNNEL_TOKEN="${CLOUDFLARE_TUNNEL_TOKEN:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASS="${ADMIN_PASS:-}"

mkdir -p "$CRED_DIR"; touch "$CRED_FILE"; chmod 600 "$CRED_FILE"
say() { echo -e "\n=== $* ==="; }
getcred() { grep "^$1=" "$CRED_FILE" 2>/dev/null | tail -1 | cut -d= -f2-; }
setcred() { grep -q "^$1=" "$CRED_FILE" 2>/dev/null || echo "$1=$2" >> "$CRED_FILE"; }

# ── 0. Template sicherstellen ────────────────────────────────────────────────
say "Template prüfen/laden: $TEMPLATE"
pveam update >/dev/null 2>&1 || true
if ! pveam list local 2>/dev/null | grep -q "$TEMPLATE"; then
  pveam download local "$TEMPLATE"
fi
TPL="local:vztmpl/$TEMPLATE"

# ── 1. DB-LXC ────────────────────────────────────────────────────────────────
DB_APP_PASS="$(getcred DB_APP_PASS)"
if [ -z "$DB_APP_PASS" ]; then DB_APP_PASS="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)"; setcred DB_APP_PASS "$DB_APP_PASS"; fi

if ! pct status "$DB_CTID" >/dev/null 2>&1; then
  say "DB-LXC $DB_CTID erstellen"
  DB_ROOT_PASS="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24)"; setcred "LXC${DB_CTID}_ROOT" "$DB_ROOT_PASS"
  pct create "$DB_CTID" "$TPL" \
    --hostname notes-db --cores 1 --memory 512 --swap 256 \
    --rootfs "$STORAGE:2" \
    --net0 "name=eth0,bridge=$BRIDGE,ip=$DB_IP/$CIDR,gw=$GATEWAY" \
    --nameserver "$NAMESERVER" --unprivileged 1 --onboot 1 --password "$DB_ROOT_PASS"
  pct start "$DB_CTID"; sleep 5
fi

say "PostgreSQL installieren + Schema einspielen"
pct exec "$DB_CTID" -- bash -c "export DEBIAN_FRONTEND=noninteractive; apt-get update -qq; apt-get install -y -qq postgresql postgresql-contrib >/dev/null; systemctl enable --now postgresql"
# Listen + pg_hba für Web-LXC
pct exec "$DB_CTID" -- bash -c "
  PGV=\$(ls /etc/postgresql); CONF=/etc/postgresql/\$PGV/main
  sed -i \"s/^#\\?listen_addresses.*/listen_addresses = 'localhost,$DB_IP'/\" \$CONF/postgresql.conf
  grep -q '$WEB_IP/32' \$CONF/pg_hba.conf || echo 'host $DB_NAME $DB_USER $WEB_IP/32 scram-sha-256' >> \$CONF/pg_hba.conf
  systemctl restart postgresql
"
# DB + User (idempotent)
pct exec "$DB_CTID" -- su - postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'\" | grep -q 1 || psql -c \"CREATE USER $DB_USER WITH PASSWORD '$DB_APP_PASS';\""
pct exec "$DB_CTID" -- su - postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='$DB_NAME'\" | grep -q 1 || psql -c \"CREATE DATABASE $DB_NAME OWNER $DB_USER;\""
# Schema einspielen
pct push "$DB_CTID" "$REPO_ROOT/deploy/schema.sql" /tmp/schema.sql
pct exec "$DB_CTID" -- su - postgres -c "psql -d $DB_NAME -v ON_ERROR_STOP=1 -f /tmp/schema.sql"
pct exec "$DB_CTID" -- su - postgres -c "psql -d $DB_NAME -c \"ALTER TABLE users OWNER TO $DB_USER; ALTER TABLE folders OWNER TO $DB_USER; ALTER TABLE notes OWNER TO $DB_USER; ALTER TABLE app_state OWNER TO $DB_USER; ALTER TABLE sessions OWNER TO $DB_USER;\""

# ── 2. Web-LXC ───────────────────────────────────────────────────────────────
if ! pct status "$WEB_CTID" >/dev/null 2>&1; then
  say "Web-LXC $WEB_CTID erstellen"
  WEB_ROOT_PASS="$(tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24)"; setcred "LXC${WEB_CTID}_ROOT" "$WEB_ROOT_PASS"
  pct create "$WEB_CTID" "$TPL" \
    --hostname notes-web --cores 2 --memory 1024 --swap 512 \
    --rootfs "$STORAGE:8" \
    --net0 "name=eth0,bridge=$BRIDGE,ip=$WEB_IP/$CIDR,gw=$GATEWAY" \
    --nameserver "$NAMESERVER" --features nesting=1 --unprivileged 1 --onboot 1 --password "$WEB_ROOT_PASS"
  pct start "$WEB_CTID"; sleep 5
fi

say "Node.js 20 + Tools installieren"
pct exec "$WEB_CTID" -- bash -c "
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq curl ca-certificates gnupg git >/dev/null
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
  apt-get install -y -qq nodejs >/dev/null
  id notesapp >/dev/null 2>&1 || useradd --system --home /opt/notes-app --shell /usr/sbin/nologin notesapp
"

say "App deployen"
APP_TAR="/tmp/notes-app-deploy.tar.gz"
tar -czf "$APP_TAR" -C "$REPO_ROOT/app" .
pct push "$WEB_CTID" "$APP_TAR" /tmp/app.tar.gz
pct exec "$WEB_CTID" -- bash -c "
  mkdir -p /opt/notes-app /etc/notes-app
  tar -xzf /tmp/app.tar.gz -C /opt/notes-app
  mv -f /opt/notes-app/notes-app.service /etc/systemd/system/notes-app.service
  [ -f /opt/notes-app/unoserver.service ] && mv -f /opt/notes-app/unoserver.service /etc/systemd/system/unoserver.service
  cd /opt/notes-app && npm install --omit=dev --no-audit --no-fund >/dev/null 2>&1
  mkdir -p /opt/notes-app/.unoserver /opt/notes-app/cache/office
  chown -R notesapp:notesapp /opt/notes-app
"

say "env-Datei schreiben"
pct exec "$WEB_CTID" -- bash -c "cat >/etc/notes-app/env <<EOF
NODE_ENV=production
PORT=3000
BIND_HOST=127.0.0.1
DB_HOST=$DB_IP
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASS=$DB_APP_PASS
COOKIE_SECURE=1
EOF
chmod 600 /etc/notes-app/env"

say "LibreOffice + unoserver (Office→PDF)"
pct exec "$WEB_CTID" -- bash -c "
  export DEBIAN_FRONTEND=noninteractive
  apt-get install -y -qq libreoffice-impress libreoffice-writer libreoffice-calc libreoffice-draw python3-uno python3-pip fonts-dejavu fonts-liberation librsvg2-bin --no-install-recommends >/dev/null 2>&1
  pip install --break-system-packages -q unoserver >/dev/null 2>&1 || true
  systemctl daemon-reload
  systemctl enable --now unoserver 2>/dev/null || true
"

if [ -n "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
  say "cloudflared installieren + Tunnel starten"
  pct exec "$WEB_CTID" -- bash -c "
    mkdir -p /usr/share/keyrings
    curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg > /usr/share/keyrings/cloudflare-main.gpg
    echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared bookworm main' > /etc/apt/sources.list.d/cloudflared.list
    apt-get update -qq && apt-get install -y -qq cloudflared >/dev/null
    cloudflared service install $CLOUDFLARE_TUNNEL_TOKEN
  "
else
  echo 'HINWEIS: CLOUDFLARE_TUNNEL_TOKEN nicht gesetzt — cloudflared übersprungen (manuell nachholen, siehe README).'
fi

say "App starten"
pct exec "$WEB_CTID" -- bash -c "systemctl daemon-reload; systemctl enable --now notes-app; sleep 2; systemctl is-active notes-app"

# ── 3. Firewall ──────────────────────────────────────────────────────────────
say "PVE-Firewall (DB nur von Web-LXC erreichbar, Web nur Loopback)"
mkdir -p /etc/pve/firewall
cat >/etc/pve/firewall/cluster.fw <<EOF
[OPTIONS]
enable: 1
policy_in: ACCEPT
policy_out: ACCEPT
EOF
cat >/etc/pve/firewall/${WEB_CTID}.fw <<EOF
[OPTIONS]
enable: 1
policy_in: DROP
policy_out: ACCEPT
[RULES]
IN ACCEPT -p icmp -log nolog
EOF
cat >/etc/pve/firewall/${DB_CTID}.fw <<EOF
[OPTIONS]
enable: 1
policy_in: DROP
policy_out: ACCEPT
[RULES]
IN ACCEPT -p icmp -log nolog
IN ACCEPT -p tcp -dport 5432 -source $WEB_IP -log nolog
EOF
systemctl reload pve-firewall 2>/dev/null || systemctl restart pve-firewall 2>/dev/null || true

# ── 4. Admin-User ────────────────────────────────────────────────────────────
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASS" ]; then
  say "Admin-User anlegen: $ADMIN_EMAIL"
  pct exec "$WEB_CTID" -- node /opt/notes-app/admin-tool.js create "$ADMIN_EMAIL" "$ADMIN_PASS" --admin || true
else
  echo 'HINWEIS: ADMIN_EMAIL/ADMIN_PASS nicht gesetzt — Admin-User manuell anlegen:'
  echo "  pct exec $WEB_CTID -- node /opt/notes-app/admin-tool.js create EMAIL PASSWORT --admin"
fi

say "FERTIG"
cat <<EOF
Web-LXC:  $WEB_IP   (App auf 127.0.0.1:3000, via cloudflared exposed)
DB-LXC:   $DB_IP    (PostgreSQL, nur intern)
Secrets:  $CRED_FILE

Noch manuell (siehe README »Cloudflare«):
  - Cloudflare Tunnel anlegen + Public-Hostname -> http://localhost:3000
  - DNS CNAME notes.<domain> -> <tunnel>.cfargotunnel.com
  - Cloudflare Access Policy (Google-Login + erlaubte E-Mails)
EOF
