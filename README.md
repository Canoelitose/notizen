# Notizen — self-hosted Notes App

Eine self-hostbare Notiz-App: React-Frontend + Node/Express-Backend + PostgreSQL.
Jeder betreibt sie mit seiner **eigenen Datenbank** — als Desktop-App, im Docker-
Container oder auf einem Proxmox-Host. Beim ersten Start verbindest du deine DB
über einen **Einrichtungs-Assistenten** im Browser.

## Schnellstart — wähle einen Weg

### 🖥️ Desktop-App (Windows/Linux/macOS)
Eine echte App, die den Server lokal mitstartet (wie Obsidian).
```bash
cd desktop && npm install && npm start          # entwickeln/ausprobieren
cd desktop && npm run dist:win                   # Installer (.exe) bauen -> desktop/dist/
```

### 🐳 Docker (Server / NAS / Cloud) — One-Liner
```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/Canoelitose/notizen/main/install.sh)" -- docker
```
…oder manuell:
```bash
cp .env.docker.example .env   # DB_PASS, ADMIN_* ausfüllen
docker compose up -d --build  # http://localhost:3000
```

### 🧱 Proxmox (zwei LXC: App + DB)
```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/Canoelitose/notizen/main/install.sh)" -- proxmox
```

### 🪟 Windows lokal (ein Skript, Autostart)
```powershell
powershell -ExecutionPolicy Bypass -File local\setup-local.ps1   # als Admin
```

Alle Details, DB-Optionen (per IP **oder** Cloudflare-Tunnel) und Daten-Umzug:
**[SELFHOSTING.md](SELFHOSTING.md)**.

## Architektur

```
Browser / PWA / Desktop-Fenster
   │ HTTP(S)
   ▼
Express-Server (app/server.js)  ── bcryptjs-Login, Sessions, /api/state
   │ pg
   ▼
PostgreSQL   (users · folders · notes · app_state · sessions)
```

- **Eine Datenschicht** (`app/db-config.js`): Verbindung aus `DATABASE_URL` ODER
  `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASS` (+ optional `DB_SSL`).
- **Ohne DB-Config** zeigt der Server den Einrichtungs-Assistenten (`/setup`):
  DB eingeben → testen → Schema + Login anlegen → fertig.
- **Notiz-Inhalt** liegt als JSONB in `notes.data` — neue Felder brauchen kein
  Schema-Update.

## Repo-Layout

| Pfad | Inhalt |
|---|---|
| `app/` | Anwendung: `server.js`, `db-config.js`, `init-db.js`, `admin-tool.js`, `public/` (Frontend + `setup.html`) |
| `desktop/` | Electron-Desktop-App (startet den Server lokal) |
| `deploy/` | Proxmox-Provisionierung (`provision.sh`), `schema.sql`, `db-tunnel/` (DB über Cloudflare-Tunnel) |
| `local/` | Windows-Setup-Skripte (`setup-local.ps1`, Autostart) |
| `install.sh` | One-Liner-Installer (Docker / Proxmox) |
| `Dockerfile`, `docker-compose.yml` | Docker-Variante (Office-Vorschau per Build-Flag `INCLUDE_OFFICE`) |

## Frontend bauen
Das Frontend ist React (über CDN, ohne Build-Tool). Nach Änderungen an
`app/public/*.jsx`:
```bash
cd app && node build-jsx.js     # kompiliert public/*.jsx -> public/dist/ + index.prod.html
```

## Sicherheit
- Login mit bcryptjs-Hashes + Session-Tabelle, HttpOnly-Cookies, Login-Rate-Limit.
- Server bindet standardmässig nur Loopback; alles per `user_id` getrennt.
- Der Einrichtungs-Assistent ist nur aktiv, solange **keine** DB konfiguriert ist;
  bei Remote-Bind zusätzlich durch ein Setup-Token geschützt.
