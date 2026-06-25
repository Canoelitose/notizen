# Notizen — Desktop-App (Electron, Local-First)

Eine native Desktop-App, die den Notizen-Server **lokal selbst startet** und in
einem eigenen Fenster zeigt — wie **Obsidian** eine Electron-App um Webtechnik
herum ist. Beim ersten Start ohne Datenbank erscheint der **Einrichtungs-
Assistent** (`/setup`): jeder verbindet seine eigene PostgreSQL. Es wird **kein**
externer Server und **keine** Internetverbindung gebraucht.

> Früher lud diese Shell die Live-Webseite. Jetzt läuft alles lokal (Frontend +
> `server.js`), passend zum Self-Hosting-Konzept. Daten/Config liegen in AppData.

## Wie es funktioniert
- `main.js` setzt die Umgebung (Port 47600, nur 127.0.0.1, Datenpfade in AppData)
  und startet `app/server.js` **im Hauptprozess**, wartet auf den Server und lädt
  dann `http://127.0.0.1:47600/` ins Fenster.
- Schreibbare Daten (DB-Config `db-connection.json`, Snapshots, Office-Cache)
  liegen in `%AppData%\Notizen\` — **nicht** im Programmordner. Deine Notizen
  selbst liegen in deiner PostgreSQL.
- Tray-Icon, Single-Instance, persistenter Login wie gehabt.

## Voraussetzung
Der Server braucht die Abhängigkeiten in `app/node_modules` (reines JavaScript,
kein nativer Build mehr — `bcryptjs` statt `bcrypt`). Einmalig:
```bash
cd app && npm install
```

## Entwickeln (mit Live-Code)
```bash
cd desktop
npm install
npm start            # startet die App + lokalen Server aus ../app
```
Änderungen testen:
- **Backend** (`app/server.js` …): App neu starten (`npm start`).
- **Frontend** (`app/public/*.jsx`): die App lädt die **vorkompilierte** Version
  (`index.prod.html`). Nach JSX-Änderungen also `cd app && node build-jsx.js`,
  dann im Fenster `Strg+R` (neu laden). Alternativ `app/public/index.prod.html`
  löschen → Babel-Version (`index.html`) lädt `.jsx` direkt, dann reicht `Strg+R`.

## Installer / .exe bauen
```bash
cd app && npm install --omit=dev   # schlankere App im Build (optional)
cd ../desktop
npm run dist:win     # Windows: NSIS-Installer (.exe) + portable .exe -> dist/
npm run dist:linux   # Linux:   AppImage + .deb
npm run dist:mac     # macOS:   .dmg  (nur auf einem Mac)
```
Ergebnis in `desktop/dist/` (gitignored). Der NSIS-Installer lässt den
Zielordner wählen; pro-Benutzer-Installation (kein Admin nötig).

## „Ich habe was geändert — wie aktualisiere ich die installierte App?"
Die installierte `.exe` enthält eine **Kopie** des Codes (Stand beim Bauen).
Code ändern → installierte App aktualisieren geht so:

1. **Während der Entwicklung** brauchst du gar nichts neu zu installieren:
   `npm start` (oben) läuft auf dem Live-Code im Repo.
2. **Neue Version verteilen/installieren:** Version in `desktop/package.json`
   hochzählen (z.B. `1.0.1`), dann `npm run dist:win` → neue `.exe` in
   `desktop/dist/`. Diese ausführen — sie **überschreibt** die alte Installation.
   Deine Daten bleiben (liegen in der DB + `%AppData%\Notizen\`), nicht im Programm.
3. **Automatische Updates** (App lädt Updates selbst): geht mit
   `electron-updater` + GitHub-Releases als Quelle — ein paar Zeilen in `main.js`
   und ein `publish`-Eintrag in der Build-Config. Ist noch **nicht** eingebaut;
   sag Bescheid, dann richte ich es ein (dann genügt künftig: neue Version
   taggen + Release hochladen, die App aktualisiert sich beim Start selbst).

## Stack
Electron 33 + electron-builder. Der Server ist reines JavaScript (Express, pg,
bcryptjs, cookie-parser) — **keine** nativen Module, daher kein `electron-rebuild`
nötig; `app/` wird einfach als `extraResources` mitgepackt.

## Hinweis Code-Signing
Die Installer sind **unsigniert** → Windows SmartScreen warnt beim ersten Start
(„Weitere Informationen" → „Trotzdem ausführen"). Signierte Builds bräuchten ein
(kostenpflichtiges) Zertifikat — für den Eigengebrauch unnötig.
