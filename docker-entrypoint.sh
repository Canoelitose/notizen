#!/bin/sh
# Container-Start: optional unoserver warm starten, Schema+Admin sicherstellen,
# dann die App starten.
set -e

if [ "$INCLUDE_OFFICE" = "true" ] && command -v unoserver >/dev/null 2>&1; then
  echo "Starte unoserver (Office->PDF) auf Port 2003 …"
  unoserver --port 2003 --interface 127.0.0.1 >/tmp/unoserver.log 2>&1 &
fi

# Wartet auf die DB, legt Schema an (idempotent) und ggf. den Admin-User
# (ADMIN_EMAIL/ADMIN_PASS). Funktioniert für die mitgelieferte wie für eine
# entfernte DB (per IP oder Cloudflare-Tunnel).
echo "Initialisiere Datenbank …"
node init-db.js

echo "Starte notes-app …"
exec node server.js
