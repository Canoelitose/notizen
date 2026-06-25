# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Sprache: **Deutsch**. Code-Kommentare gemischt DE/EN — beim Schreiben den Stil der Datei treffen.

## Was das ist
Self-hostbare Notiz-App: React-Frontend (kein Build-Tool) + Express + PostgreSQL.
Local-First — jeder betreibt eigenen Server + eigene DB (Desktop/Docker/Proxmox).
Drei Teilprojekte mit eigener `package.json`: `app/` (Anwendung), `desktop/`
(Electron), plus Skripte in `deploy/`, `local/`, `install.sh`.

## Befehle
```bash
cd app && npm install && node build-jsx.js   # public/*.jsx -> public/dist/ + index.prod.html (PFLICHT nach JSX-Änderung)
cd app && node server.js                       # Server lokal (ohne DB-Config -> Setup-Assistent auf /setup)
cd app && node admin-tool.js create EMAIL PW --admin
cd desktop && npm install && npm start         # Electron-App (startet Server lokal mit)
cd desktop && npm run dist:win                 # Installer .exe -> desktop/dist/
```
Kein Test-Framework; Smoke-Tests in `deploy/test/` (gegen einen echten Host).

## Architektur — das Wichtige
- **Kein Frontend-Modulsystem:** jede `app/public/*.jsx` hängt Komponenten an `window`;
  die **Ladereihenfolge in `index.html`** ist signifikant. `dist/` ist generiert
  (`build-jsx.js`) — nie von Hand editieren. `server.js` serviert `index.prod.html`
  falls vorhanden, sonst `index.html` (Babel-Version).
- **Zentrale DB-Config [app/db-config.js](app/db-config.js):** `DATABASE_URL` ODER
  `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASS` (+ `DB_SSL`), gelesen aus `process.env`
  und `app/.env`/`/etc/notes-app/env`. `isConfigured()` entscheidet, ob der
  Einrichtungs-Assistent läuft. Genutzt von `server.js`, `admin-tool.js`, `init-db.js`.
- **Einrichtungs-Assistent (GUI):** ohne DB-Config → `/` leitet auf `/setup`
  ([app/public/setup.html](app/public/setup.html)); `/api/setup/test|save` prüft die
  Verbindung, legt Schema + Erst-Admin an (über `init-db.js`), persistiert nach
  `app/db-connection.json` (gitignored). **Nur** aktiv bei fehlender Config — bei
  vorhandener Config aber toter DB NICHT der Wizard (Login-/Fehlerpfad). Setup-Endpunkte
  durch `setupGuard` + (bei Remote-Bind) Setup-Token geschützt.
- **Dynamischer Port (Electron):** Electron setzt `PORT=0` → OS wählt freien Port;
  `server.js` schreibt den tatsächlichen Port nach `$NOTES_DATA_DIR/runtime-port`,
  `desktop/main.js` liest ihn. Verhindert „Port belegt"-Abstürze unter Windows.
- **Schreibbare Pfade:** `NOTES_DATA_DIR` (Snapshots/Cache) + `DB_CONFIG_FILE`; in der
  Electron-App auf AppData gesetzt (Programmordner ist read-only).
- **Auth/Hashing:** **bcryptjs** (reines JS, kein nativer Build → Electron-tauglich;
  hash-kompatibel zu node-bcrypt-`$2b$`-Hashes).

## DB-Schema ([deploy/schema.sql](deploy/schema.sql))
Alles per `user_id`. `folders`/`notes` mit composite PK `(user_id, id)`, `id` ist
TEXT (client-vergeben). **Notiz-Inhalt komplett als JSONB in `notes.data`.**
`folders.parent_id` self-reference **ohne FK** (bewusst). `templates`/`trash` in
`app_state.state` (JSONB).

## Datenverlust-Schutz (NICHT entfernen)
`PUT /api/state` lehnt leeren Payload ab (`409 empty_guard`), wenn die DB Daten hat
(ausser `?allowEmpty=1`); vor jedem destruktiven Write ein Snapshot nach
`$NOTES_DATA_DIR/snapshots/`. Frontend speichert erst nach erfolgreichem Initial-Load.

## Self-Hosting / Deployment
`install.sh` = One-Liner-Helper (Docker/Proxmox, Cloudflare-Tunnel-Option).
Docker: `Dockerfile` (Build-Arg `INCLUDE_OFFICE` zieht LibreOffice rein) +
`docker-compose.yml` (App + Postgres + cloudflared-Profile). Proxmox:
`deploy/provision.sh`. DB per Tunnel: `deploy/db-tunnel/`. Details: [SELFHOSTING.md](SELFHOSTING.md).

## Regeln
- Secrets nie committen (`.env`, `db-connection.json`, credentials — alle gitignored).
- Nach JSX-Änderung `build-jsx.js`, sonst sieht die Prod-Version (`dist/`) nichts.
- Office→PDF (`/api/convert/office`) braucht LibreOffice+unoserver (nur Docker-`full`/Proxmox).
