#!/bin/bash
# db-lxc.sh — erstellt EINEN Proxmox-LXC mit nur PostgreSQL für die Notizen-App.
#
# Die App (Desktop/Electron, Docker, …) verbindet sich per IP gegen diese DB.
# Schema wird eingespielt; dein Login legst du danach im App-Assistenten an.
#
# Aufruf (Werte via Umgebung oder deploy/.env):
#   DB_CTID=108 DB_IP=10.10.11.108 bash deploy/db-lxc.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$REPO_ROOT/deploy/.env" ] && source "$REPO_ROOT/deploy/.env"

DB_CTID="${DB_CTID:?DB_CTID setzen (freie Container-ID, z.B. 108)}"
DB_IP="${DB_IP:?DB_IP setzen (freie IP, z.B. 10.10.11.108)}"
CIDR="${CIDR:-23}"
GATEWAY="${GATEWAY:-10.10.10.1}"
BRIDGE="${BRIDGE:-vmbr0}"
STORAGE="${STORAGE:-local-lvm}"
NAMESERVER="${NAMESERVER:-1.1.1.1 9.9.9.9}"
TEMPLATE="${TEMPLATE:-debian-12-standard_12.12-1_amd64.tar.zst}"
DB_NAME="${DB_NAME:-notes_app}"
DB_USER="${DB_USER:-notes_app}"
DB_HOSTNAME="${DB_HOSTNAME:-notizen-db}"

CRED_DIR="/root/notizen"; CRED_FILE="$CRED_DIR/credentials.txt"
mkdir -p "$CRED_DIR"; touch "$CRED_FILE"; chmod 600 "$CRED_FILE"
say() { echo -e "\n=== $* ==="; }

# App-DB-Passwort generieren oder aus credentials.txt wiederverwenden
DB_APP_PASS="$(grep '^DB_APP_PASS=' "$CRED_FILE" 2>/dev/null | tail -1 | cut -d= -f2- || true)"
if [ -z "$DB_APP_PASS" ]; then
  DB_APP_PASS="$(openssl rand -hex 16)"
  echo "DB_APP_PASS=$DB_APP_PASS" >> "$CRED_FILE"
fi

say "Template prüfen/laden: $TEMPLATE"
pveam update >/dev/null 2>&1 || true
pveam list local 2>/dev/null | grep -q "$TEMPLATE" || pveam download local "$TEMPLATE"
TPL="local:vztmpl/$TEMPLATE"

if ! pct status "$DB_CTID" >/dev/null 2>&1; then
  say "LXC $DB_CTID erstellen ($DB_HOSTNAME, $DB_IP)"
  ROOT_PASS="$(openssl rand -hex 12)"
  echo "LXC${DB_CTID}_ROOT=$ROOT_PASS" >> "$CRED_FILE"
  pct create "$DB_CTID" "$TPL" \
    --hostname "$DB_HOSTNAME" --cores 1 --memory 512 --swap 256 \
    --rootfs "$STORAGE:4" \
    --net0 "name=eth0,bridge=$BRIDGE,ip=$DB_IP/$CIDR,gw=$GATEWAY" \
    --nameserver "$NAMESERVER" --unprivileged 1 --onboot 1 --password "$ROOT_PASS"
  pct start "$DB_CTID"; sleep 5
else
  say "LXC $DB_CTID existiert bereits — wird weiter konfiguriert (idempotent)"
fi

say "PostgreSQL installieren"
pct exec "$DB_CTID" -- bash -c "export DEBIAN_FRONTEND=noninteractive; apt-get update -qq; apt-get install -y -qq postgresql postgresql-contrib >/dev/null; systemctl enable --now postgresql"

say "Netzwerk + TLS-Verschlüsselung ERZWINGEN (nur verschlüsselte Verbindungen)"
pct exec "$DB_CTID" -- bash -c "
  PGV=\$(ls /etc/postgresql); CONF=/etc/postgresql/\$PGV/main
  sed -i \"s/^#\\?listen_addresses.*/listen_addresses = '*'/\" \$CONF/postgresql.conf
  sed -i \"s/^#\\?ssl[[:space:]].*/ssl = on/\" \$CONF/postgresql.conf
  grep -q '^ssl = on' \$CONF/postgresql.conf || echo 'ssl = on' >> \$CONF/postgresql.conf
  # bestehende unverschlüsselte 'host'-Regeln für uns entfernen, durch 'hostssl' ersetzen
  sed -i \"/^host[[:space:]]\\+$DB_NAME[[:space:]]\\+$DB_USER/d\" \$CONF/pg_hba.conf
  for net in 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16; do
    grep -q \"hostssl $DB_NAME $DB_USER \$net\" \$CONF/pg_hba.conf || echo \"hostssl $DB_NAME $DB_USER \$net scram-sha-256\" >> \$CONF/pg_hba.conf
  done
  systemctl restart postgresql
"

say "Datenbank + Benutzer + Schema"
pct exec "$DB_CTID" -- su - postgres -c "psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'\" | grep -q 1 || psql -c \"CREATE USER $DB_USER WITH PASSWORD '$DB_APP_PASS';\""
pct exec "$DB_CTID" -- su - postgres -c "psql -c \"ALTER USER $DB_USER WITH PASSWORD '$DB_APP_PASS';\""
pct exec "$DB_CTID" -- su - postgres -c "psql -tAc \"SELECT 1 FROM pg_database WHERE datname='$DB_NAME'\" | grep -q 1 || psql -c \"CREATE DATABASE $DB_NAME OWNER $DB_USER;\""
pct push "$DB_CTID" "$REPO_ROOT/deploy/schema.sql" /tmp/schema.sql
pct exec "$DB_CTID" -- su - postgres -c "psql -d $DB_NAME -v ON_ERROR_STOP=1 -f /tmp/schema.sql"
pct exec "$DB_CTID" -- su - postgres -c "psql -d $DB_NAME -c \"ALTER TABLE users OWNER TO $DB_USER; ALTER TABLE folders OWNER TO $DB_USER; ALTER TABLE notes OWNER TO $DB_USER; ALTER TABLE app_state OWNER TO $DB_USER; ALTER TABLE sessions OWNER TO $DB_USER;\""

cat <<INFO

════════════════════════════════════════════════════════════
  ✓ PostgreSQL-Container bereit!

  In der App (Einrichtungs-Assistent) eingeben:
     Host:       $DB_IP
     Port:       5432
     Datenbank:  $DB_NAME
     Benutzer:   $DB_USER
     Passwort:   $DB_APP_PASS
     >>> Haken "SSL/TLS erzwingen" SETZEN  (Verbindung ist nur verschlüsselt erlaubt)

  (Zugangsdaten auch gespeichert in: $CRED_FILE)
════════════════════════════════════════════════════════════
INFO
