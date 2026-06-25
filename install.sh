#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Notizen-App — One-Liner-Installer (im Stil der Proxmox VE Helper-Scripts)
#
# Auf einem Linux-Server / Proxmox-Host ausführen:
#
#   bash -c "$(curl -fsSL https://raw.githubusercontent.com/Canoelitose/notizen/main/install.sh)"
#
# Modus direkt wählen (überspringt das Menü):
#   bash -c "$(curl -fsSL .../install.sh)" -- docker
#   bash -c "$(curl -fsSL .../install.sh)" -- proxmox
#
# Macht: Repo holen, abfragen (DB/Admin/Cloudflare), und entweder einen
# Docker-Stack hochfahren ODER auf einem Proxmox-Host zwei LXC bauen.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_URL="https://github.com/Canoelitose/notizen.git"
INSTALL_DIR="${NOTES_DIR:-$HOME/notizen}"
MODE="${1:-}"

# ── Ausgabe-Helfer ───────────────────────────────────────────────────────────
if [ -t 1 ]; then C_B="\033[1m"; C_G="\033[32m"; C_Y="\033[33m"; C_R="\033[31m"; C_C="\033[36m"; C_0="\033[0m"; else C_B=; C_G=; C_Y=; C_R=; C_C=; C_0=; fi
say()  { echo -e "\n${C_C}${C_B}==>${C_0} ${C_B}$*${C_0}"; }
ok()   { echo -e "    ${C_G}✓${C_0} $*"; }
warn() { echo -e "    ${C_Y}!${C_0} $*"; }
die()  { echo -e "\n${C_R}Fehler:${C_0} $*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

ask() { # ask "Frage" "default" -> echo Antwort
  local q="$1" def="${2:-}" ans
  if [ -n "$def" ]; then read -r -p "$(echo -e "    ${C_B}$q${C_0} [${def}]: ")" ans || true; echo "${ans:-$def}"
  else read -r -p "$(echo -e "    ${C_B}$q${C_0}: ")" ans || true; echo "$ans"; fi
}
ask_secret() { # ask_secret "Frage" -> echo Antwort (versteckt)
  local q="$1" ans; read -r -s -p "$(echo -e "    ${C_B}$q${C_0}: ")" ans || true; echo >&2; echo "$ans"
}
yesno() { # yesno "Frage" "j|n default" -> 0/1
  local q="$1" def="${2:-n}" ans
  read -r -p "$(echo -e "    ${C_B}$q${C_0} ($([ "$def" = j ] && echo "J/n" || echo "j/N")): ")" ans || true
  ans="${ans:-$def}"; [[ "$ans" =~ ^[jJyY] ]]
}
randpw() { openssl rand -base64 18 2>/dev/null | tr -dc 'A-Za-z0-9' | cut -c1-24 || head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | cut -c1-24; }

banner() {
  echo -e "${C_C}${C_B}"
  echo "   _   _       _   _              "
  echo "  | \\ | |     | | (_)             "
  echo "  |  \\| | ___ | |_ _ _______ _ __ "
  echo "  | . \` |/ _ \\| __| |_  / _ \\ '_ \\ "
  echo "  | |\\  | (_) | |_| |/ /  __/ | | |"
  echo "  |_| \\_|\\___/ \\__|_/___\\___|_| |_|"
  echo -e "        self-hosted Notizen-App${C_0}\n"
}

ensure_repo() {
  if [ -d "$INSTALL_DIR/.git" ]; then
    say "Repo aktualisieren ($INSTALL_DIR)"; git -C "$INSTALL_DIR" pull --ff-only || warn "git pull übersprungen"
  else
    have git || die "git fehlt. Installieren: apt-get install -y git"
    say "Repo holen nach $INSTALL_DIR"; git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
  fi
  ok "Repo bereit"
}

# ── Docker installieren, falls nötig ─────────────────────────────────────────
ensure_docker() {
  if ! have docker; then
    if yesno "Docker ist nicht installiert — jetzt installieren (get.docker.com)?" j; then
      say "Docker installieren"; curl -fsSL https://get.docker.com | sh
    else die "Docker wird gebraucht. Abbruch."; fi
  fi
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 fehlt (Plugin 'docker compose'). Bitte aktualisieren."
  ok "Docker bereit: $(docker --version)"
}

# ── Cloudflare-Tunnel abfragen (gemeinsam) ───────────────────────────────────
CF_TOKEN=""
ask_cloudflare() {
  say "Cloudflare-Tunnel (optional)"
  echo "    Damit ist die App von aussen erreichbar (HTTPS), ohne offenen Port."
  echo "    Du brauchst dafür einen Tunnel-Token aus dem Cloudflare-Zero-Trust-Dashboard"
  echo "    (Networks → Tunnels → Create → Token kopieren)."
  if yesno "Per Cloudflare-Tunnel veröffentlichen?" n; then
    CF_TOKEN="$(ask "Cloudflare Tunnel-Token")"
    [ -n "$CF_TOKEN" ] && ok "Tunnel-Token gesetzt" || warn "kein Token — Tunnel übersprungen"
  fi
}

# ── DOCKER-Pfad ──────────────────────────────────────────────────────────────
install_docker() {
  ensure_repo; ensure_docker
  cd "$INSTALL_DIR"

  say "Konfiguration"
  local db_pass admin_email admin_pass office app_port
  db_pass="$(ask 'DB-Passwort (Enter = zufällig)' "$(randpw)")"
  admin_email="$(ask 'Admin E-Mail (dein Login)' 'admin@example.com')"
  admin_pass="$(ask_secret 'Admin Passwort (min. 8, Enter = zufällig)')"; [ -n "$admin_pass" ] || admin_pass="$(randpw)"
  app_port="$(ask 'Host-Port' '3000')"
  if yesno 'Office→PDF-Vorschau (LibreOffice, grosses Image ~1.5 GB)?' n; then office=true; else office=false; fi
  ask_cloudflare

  say "Schreibe .env"
  cat > .env <<EOF
DB_NAME=notes_app
DB_USER=notes_app
DB_PASS=${db_pass}
APP_PORT=${app_port}
COOKIE_SECURE=$([ -n "$CF_TOKEN" ] && echo 1 || echo 0)
INCLUDE_OFFICE=${office}
ADMIN_EMAIL=${admin_email}
ADMIN_PASS=${admin_pass}
CLOUDFLARE_TUNNEL_TOKEN=${CF_TOKEN}
EOF
  chmod 600 .env; ok ".env geschrieben"

  say "Container bauen + starten (kann beim ersten Mal dauern)"
  if [ -n "$CF_TOKEN" ]; then docker compose --profile tunnel-web up -d --build
  else docker compose up -d --build; fi

  echo
  ok "Fertig! Notizen läuft."
  if [ -n "$CF_TOKEN" ]; then echo -e "    Erreichbar über deine Cloudflare-Tunnel-Domain."
  else echo -e "    Lokal:  ${C_B}http://localhost:${app_port}${C_0}  (bzw. http://<server-ip>:${app_port})"; fi
  echo -e "    Login:  ${C_B}${admin_email}${C_0}"
  echo -e "    Logs:   ${C_C}docker compose -f $INSTALL_DIR/docker-compose.yml logs -f${C_0}"
}

# ── PROXMOX-Pfad ─────────────────────────────────────────────────────────────
install_proxmox() {
  have pct || die "Das ist kein Proxmox-Host (Befehl 'pct' fehlt). Auf dem PVE-Host ausführen."
  ensure_repo
  cd "$INSTALL_DIR"

  say "Proxmox-Konfiguration"
  [ -f deploy/.env ] || cp deploy/.env.example deploy/.env
  echo "    Bereits belegte Container-IDs auf diesem Host:"
  pct list 2>/dev/null | awk 'NR>1 {printf "      %s  %s\n", $1, $NF}' || true
  echo "    -> Wähle FREIE Nummern (NICHT die oben gelisteten)."
  local web_ctid db_ctid web_ip db_ip admin_email admin_pass
  web_ctid="$(ask 'Container-ID Web (frei)' '106')"
  db_ctid="$(ask  'Container-ID DB (frei)'  '107')"
  for _id in "$web_ctid" "$db_ctid"; do
    if pct status "$_id" >/dev/null 2>&1; then
      die "Container $_id existiert bereits — bitte freie IDs wählen (sonst würde dein bestehendes Setup verändert)."
    fi
  done
  web_ip="$(ask   'IP Web-Container'   '10.10.11.106')"
  db_ip="$(ask    'IP DB-Container'    '10.10.11.107')"
  admin_email="$(ask 'Admin E-Mail (dein Login)' 'admin@example.com')"
  admin_pass="$(ask_secret 'Admin Passwort (min. 8, Enter = zufällig)')"; [ -n "$admin_pass" ] || admin_pass="$(randpw)"
  ask_cloudflare

  say "Schreibe deploy/.env"
  cat > deploy/.env <<EOF
WEB_CTID="${web_ctid}"
DB_CTID="${db_ctid}"
WEB_IP="${web_ip}"
DB_IP="${db_ip}"
CIDR="23"
GATEWAY="10.10.10.1"
BRIDGE="vmbr0"
STORAGE="local-lvm"
NAMESERVER="1.1.1.1 9.9.9.9"
TEMPLATE="debian-12-standard_12.12-1_amd64.tar.zst"
DB_NAME="notes_app"
DB_USER="notes_app"
ADMIN_EMAIL="${admin_email}"
ADMIN_PASS="${admin_pass}"
CLOUDFLARE_TUNNEL_TOKEN="${CF_TOKEN}"
EOF
  chmod 600 deploy/.env
  warn "Prüfe ggf. Netzwerk-Werte (Bridge/Gateway/Storage) in deploy/.env."
  if yesno "Jetzt provisionieren (zwei LXC bauen)?" j; then
    say "deploy/provision.sh läuft …"; bash deploy/provision.sh
    ok "Fertig — Zugangsdaten in /root/notes-app/credentials.txt"
  else
    ok "deploy/.env vorbereitet. Start mit:  bash $INSTALL_DIR/deploy/provision.sh"
  fi
}

# ── PROXMOX: nur Datenbank (für Desktop/Electron-App) ────────────────────────
install_proxmox_db() {
  have pct || die "Das ist kein Proxmox-Host (Befehl 'pct' fehlt). Auf dem PVE-Host ausführen."
  ensure_repo
  cd "$INSTALL_DIR"

  say "Datenbank-Container (nur PostgreSQL) — für die Desktop-/Electron-App"
  echo "    Die App läuft bei dir lokal; sie braucht nur diese Datenbank zum Verbinden."
  echo "    Bereits belegte Container-IDs:"
  pct list 2>/dev/null | awk 'NR>1 {printf "      %s  %s\n", $1, $NF}' || true
  echo "    -> Wähle eine FREIE Nummer."
  local ctid ip allow
  ctid="$(ask 'Container-ID (frei)' '108')"
  pct status "$ctid" >/dev/null 2>&1 && die "Container $ctid existiert bereits — bitte freie ID wählen."
  ip="$(ask 'IP des DB-Containers (frei, NICHT eine Node-IP)' '10.10.11.108')"
  allow="$(ask 'Welche Geräte dürfen verbinden? (CIDR)' "$(echo "$ip" | cut -d. -f1-3).0/24")"

  say "Datenbank-LXC bauen …"
  DB_CTID="$ctid" DB_IP="$ip" ALLOW_CIDR="$allow" bash deploy/db-lxc.sh
}

# ── Menü ─────────────────────────────────────────────────────────────────────
main() {
  banner
  if [ -z "$MODE" ]; then
    echo "    Wie möchtest du installieren?"
    echo -e "      ${C_B}1)${C_0} Docker      — ein Container-Stack (App + DB), überall"
    if have pct; then
      echo -e "      ${C_B}2)${C_0} Proxmox     — zwei LXC (App + DB) auf diesem Host"
      echo -e "      ${C_B}3)${C_0} Nur DB      — ein LXC nur mit PostgreSQL (für die Desktop-App)"
    fi
    echo
    local c; c="$(ask 'Auswahl' '1')"
    case "$c" in
      1) MODE=docker ;;
      2) MODE=proxmox ;;
      3) MODE=db ;;
      *) die "Ungültige Auswahl" ;;
    esac
  fi
  case "$MODE" in
    docker)  install_docker ;;
    proxmox) install_proxmox ;;
    db)      install_proxmox_db ;;
    *) die "Unbekannter Modus '$MODE' (erlaubt: docker, proxmox, db)" ;;
  esac
}

main
