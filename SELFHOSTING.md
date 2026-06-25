# Self-Hosting — Notizen-App

Die App lässt sich auf drei Arten selbst hosten. Alle nutzen **dieselbe** App und
**dieselbe** PostgreSQL-Datenstruktur — deine Notizen sind also zwischen den
Varianten portierbar (per `pg_dump`/`pg_restore`).

| Variante | Wofür | Anleitung |
|---|---|---|
| **Local (Windows)** | Auf deinem PC, ein Skript, Autostart, alles offline | [↓](#1-local-windows--ein-skript) |
| **Docker** | Ein Befehl, läuft überall (NAS, Server, Cloud) | [↓](#2-docker) |
| **Proxmox** | Zwei LXC (App + DB) wie das Live-System | [↓](#3-proxmox) |

## ⚡ Schnellinstallation (One-Liner)

Auf einem **Linux-Server oder Proxmox-Host** — ein Befehl lädt den Installer und
fragt dich interaktiv durch (DB, Admin-Login, optional Cloudflare-Tunnel):

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/Canoelitose/notizen/main/install.sh)"
```

Direkt eine Variante wählen (ohne Menü):
```bash
# Docker-Stack (App + DB) hochfahren
bash -c "$(curl -fsSL https://raw.githubusercontent.com/Canoelitose/notizen/main/install.sh)" -- docker

# Auf einem Proxmox-Host: zwei LXC bauen
bash -c "$(curl -fsSL https://raw.githubusercontent.com/Canoelitose/notizen/main/install.sh)" -- proxmox
```

> Der Installer holt das Repo, installiert bei Bedarf Docker, schreibt die `.env`
> (DB-Passwort zufällig, falls leer) und startet alles. Bei „Cloudflare?" → mit
> Tunnel-Token wird die App per HTTPS veröffentlicht (`COOKIE_SECURE=1` automatisch).

Die **Datenbank** ist in jeder Variante wahlweise **per IP** oder **per
Cloudflare-Tunnel** erreichbar → [DB-Verbindung](#db-verbindung-ip-oder-tunnel).

> **Einrichtung im Browser:** Startest du die App **ohne** vorkonfigurierte DB
> (z.B. einfach `node app/server.js`), öffnet sich ein **Einrichtungs-Assistent**
> unter `/setup`: DB-Daten eingeben → testen → Schema + Login werden angelegt.
> Danach läuft die App normal. Docker/Proxmox sind per env vorkonfiguriert und
> überspringen den Assistenten. (Local-First — der Weg zur späteren Electron-App.)

---

## 1. Local (Windows) — ein Skript

Richtet alles auf diesem PC ein (Node + lokale PostgreSQL), legt deinen Login an
und sorgt dafür, dass die App **beim Anmelden automatisch startet**.

**Einmal als Administrator ausführen:**
```powershell
powershell -ExecutionPolicy Bypass -File local\setup-local.ps1
```
(oder Rechtsklick auf `local\setup-local.ps1` → „Mit PowerShell ausführen", als Admin).

Das Skript fragt nach E-Mail + Passwort für deinen Login und öffnet danach den
Browser auf `http://127.0.0.1:3000`. PostgreSQL läuft als Windows-Dienst (startet
mit Windows), die App über eine Autostart-Aufgabe (startet beim Anmelden).

- **Manuell starten:** `powershell -File local\start-local.ps1`
- **Autostart entfernen:** `powershell -File local\uninstall-local.ps1`
  (Daten bleiben; mit `-PurgeData` wird auch die DB gelöscht)

> Nur kurz ausprobieren ohne echte DB? → `TEST.ps1` startet den JSON-Dev-Server
> (`app/dev-server.js`), ganz ohne PostgreSQL.

---

## 2. Docker

Braucht nur Docker + Docker Compose. Bringt App **und** PostgreSQL mit.

```bash
cp .env.docker.example .env       # DB_PASS, ADMIN_EMAIL, ADMIN_PASS ausfüllen
docker compose up -d --build      # http://localhost:3000
```

- **Mit Office→PDF-Vorschau** (LibreOffice, großes Image): in `.env`
  `INCLUDE_OFFICE=true`, dann `docker compose build --no-cache && docker compose up -d`.
- **App per Cloudflare-Tunnel veröffentlichen:** `CLOUDFLARE_TUNNEL_TOKEN` in `.env`,
  `COOKIE_SECURE=1`, dann `docker compose --profile tunnel-web up -d`.
- **Eigene/externe DB statt der mitgelieferten:** `DATABASE_URL` in `.env` setzen
  und nur die App starten: `docker compose up -d app`.

Der erste Start legt Schema + Admin automatisch an (`init-db.js`).

---

## 3. Proxmox

Unverändert wie gehabt — baut zwei LXC (App + DB) von Null. Siehe
[README.md](README.md#komplett-rebuild-von-null-disaster-recovery).

```bash
cp deploy/.env.example deploy/.env   # ausfüllen
bash deploy/provision.sh
```

---

## DB-Verbindung: IP oder Tunnel

Die App liest die DB-Konfiguration aus Umgebungsvariablen
([app/db-config.js](app/db-config.js)) — zwei Stile, beide gültig:

```ini
# (A) Einzelwerte
DB_HOST=10.10.11.105      # oder 127.0.0.1
DB_PORT=5432
DB_NAME=notes_app
DB_USER=notes_app
DB_PASS=...
DB_SSL=0                  # 1 = TLS erzwingen

# (B) Connection-String (gewinnt, falls gesetzt)
DATABASE_URL=postgres://notes_app:PASS@HOST:5432/notes_app
```

Diese Werte stehen je nach Variante in: `app/.env` (Local), `.env` (Docker),
`/etc/notes-app/env` (Proxmox).

### Per IP
Einfach `DB_HOST`/`DB_PORT` (oder die URL) auf die erreichbare Adresse der DB
setzen. Standardfall.

### Per Cloudflare-Tunnel
Wenn App und DB in verschiedenen Netzen liegen: ein `cloudflared`-Client öffnet
einen lokalen Port, der verschlüsselt zur entfernten DB führt. Die App verbindet
sich dann gegen `127.0.0.1`. Komplette Anleitung (Server-Ingress + Client):
[deploy/db-tunnel/README.md](deploy/db-tunnel/README.md).

```powershell
# Windows-Client
powershell -File deploy\db-tunnel\db-tunnel.ps1 -Hostname db.example.com
# danach in app/.env:  DB_HOST=127.0.0.1  DB_PORT=5432
```

---

## Daten umziehen zwischen Varianten

```bash
# Export (Quelle)
pg_dump -h <host> -U notes_app notes_app > backup.sql
# Import (Ziel) — z.B. in den Docker-DB-Container
docker compose exec -T db psql -U notes_app -d notes_app < backup.sql
```
