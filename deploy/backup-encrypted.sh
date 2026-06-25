#!/bin/bash
# backup-encrypted.sh — verschlüsseltes DB-Backup (läuft auf dem Proxmox-HOST).
#
# Macht pg_dump im DB-Container, verschlüsselt das Ergebnis mit AES-256 und legt
# es auf den NAS-Speicher. Wird per Cron täglich aufgerufen (siehe install.sh -- backup).
#
#   DB_CTID=108 BACKUP_DIR=/mnt/pve/nas-proxmox/notizen-backups bash deploy/backup-encrypted.sh
#
# WIEDERHERSTELLEN (Beispiel):
#   openssl enc -d -aes-256-cbc -pbkdf2 -pass file:/etc/notizen/backup.pass \
#     -in /mnt/pve/nas-proxmox/notizen-backups/notizen-YYYYMMDD-HHMMSS.sql.enc \
#     | pct exec 108 -- su - postgres -c "psql -d notes_app"
set -euo pipefail

DB_CTID="${DB_CTID:-108}"
DB_NAME="${DB_NAME:-notes_app}"
BACKUP_DIR="${BACKUP_DIR:-/mnt/pve/nas-proxmox/notizen-backups}"
KEEP="${KEEP:-14}"
PASS_FILE="${PASS_FILE:-/etc/notizen/backup.pass}"

[ -f "$PASS_FILE" ] || { echo "Passphrase-Datei fehlt: $PASS_FILE"; exit 1; }
# Ziel-Mount prüfen (NAS gemountet?)
PARENT="$(dirname "$BACKUP_DIR")"
[ -d "$PARENT" ] || { echo "Ziel nicht erreichbar (NAS gemountet?): $PARENT"; exit 1; }
mkdir -p "$BACKUP_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/notizen-$STAMP.sql.enc"

# pg_dump (im Container) -> AES-256 verschlüsselt -> Datei auf NAS
pct exec "$DB_CTID" -- su - postgres -c "pg_dump -d $DB_NAME" \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -pass file:"$PASS_FILE" -out "$OUT"

# Rotation: nur die letzten KEEP behalten
ls -1t "$BACKUP_DIR"/notizen-*.sql.enc 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f || true

echo "✓ Backup: $OUT ($(du -h "$OUT" | cut -f1)), behalte letzte $KEEP"
