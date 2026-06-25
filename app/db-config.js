// db-config.js — EINE Quelle der Wahrheit für die PostgreSQL-Verbindung.
// Wird von server.js und admin-tool.js genutzt und funktioniert für ALLE
// Self-Hosting-Varianten (Proxmox / Docker / Local) und beide DB-Wege
// (direkt per IP ODER per Cloudflare-Tunnel auf einen lokalen Port).
//
// Konfiguration über Umgebungsvariablen — zwei Stile, beide erlaubt:
//
//   1) Connection-String (Docker, Cloud, Tunnel):
//        DATABASE_URL=postgres://user:pass@host:5432/notes_app
//
//   2) Einzelwerte (Proxmox, Local, direkte IP):
//        DB_HOST=10.10.11.105   (oder 127.0.0.1 bei lokal / Tunnel)
//        DB_PORT=5432
//        DB_NAME=notes_app
//        DB_USER=notes_app
//        DB_PASS=...
//
//   Optional:
//        DB_SSL=1            -> TLS erzwingen (rejectUnauthorized:false)
//        DB_POOL_MAX=8       -> max. Verbindungen im Pool
//
// Secrets können auch in einer Datei stehen (KEY=VALUE pro Zeile); siehe
// loadEnvFile()/autoload(). Bereits gesetzte process.env-Werte gewinnen.

const fs = require('fs');
const path = require('path');

// Eine env-Datei (KEY=VALUE-Zeilen) in process.env laden, ohne bestehende
// Werte zu überschreiben. Fehlende Datei = stillschweigend ignoriert.
function loadEnvFile(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return false; }
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, '');
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
  return true;
}

// Übliche Speicherorte für die env-Datei automatisch einlesen:
//   - app/.env                (Local / Docker-Build)
//   - /etc/notes-app/env      (Proxmox; systemd lädt sie zwar schon, schadet nicht)
//   - $NOTES_ENV_FILE         (frei wählbarer Pfad)
function autoload() {
  if (process.env.NOTES_ENV_FILE) loadEnvFile(process.env.NOTES_ENV_FILE);
  loadEnvFile(path.join(__dirname, '.env'));
  loadEnvFile('/etc/notes-app/env');
}

function wantSsl(v) {
  return /^(1|true|require|yes)$/i.test(String(v == null ? (process.env.DB_SSL || '') : v));
}

// ---- Datei-Config (vom GUI-Einrichtungsassistenten geschrieben) -------------
// Wird genutzt, wenn KEINE DB-Variablen in der Umgebung gesetzt sind (Local/
// Electron). Inhalt: { url } ODER { host, port, name, user, pass, ssl }.
const CONFIG_FILE = process.env.DB_CONFIG_FILE || path.join(__dirname, 'db-connection.json');

function readFileConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return null; }
}
function saveFileConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}
function clearFileConfig() { try { fs.unlinkSync(CONFIG_FILE); } catch {} }

// In der Umgebung explizit gesetzte DB-Config (Docker/Proxmox)?
function hasEnvConfig() {
  return !!(process.env.DATABASE_URL || process.env.DB_HOST);
}

// Gibt es überhaupt eine Konfiguration? Nur dann läuft die App; sonst zeigt der
// Server den Einrichtungs-Assistenten. (Reine Default-Werte zählen NICHT.)
function isConfigured() {
  return hasEnvConfig() || !!readFileConfig();
}

function buildFromFields(f, max) {
  const ssl = wantSsl(f.ssl) ? { rejectUnauthorized: false } : undefined;
  if (f.url) return { connectionString: f.url, ssl, max };
  return {
    host: f.host || '127.0.0.1',
    port: Number(f.port || 5432),
    database: f.name || 'notes_app',
    user: f.user || 'notes_app',
    password: f.pass || '',
    ssl, max,
  };
}

// Fertige node-postgres Pool-Konfiguration: env > Datei-Config > Default.
function poolConfig() {
  const max = Number(process.env.DB_POOL_MAX || 8);
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL, ssl: wantSsl() ? { rejectUnauthorized: false } : undefined, max };
  }
  if (process.env.DB_HOST) {
    return buildFromFields({
      host: process.env.DB_HOST, port: process.env.DB_PORT, name: process.env.DB_NAME,
      user: process.env.DB_USER, pass: process.env.DB_PASS, ssl: process.env.DB_SSL,
    }, max);
  }
  const fc = readFileConfig();
  if (fc) return buildFromFields(fc, max);
  // Letzter Fallback (z.B. CLI mit teilweise gesetzter Umgebung).
  return buildFromFields({}, max);
}

// Kurze, secret-freie Beschreibung fürs Log.
function describe() {
  const c = poolConfig();
  if (c.connectionString) {
    try { const u = new URL(c.connectionString); return `${u.hostname}:${u.port || 5432}${u.pathname}`; }
    catch { return 'DATABASE_URL'; }
  }
  return `${c.host}:${c.port}/${c.database}`;
}

module.exports = {
  loadEnvFile, autoload, poolConfig, describe,
  isConfigured, hasEnvConfig, readFileConfig, saveFileConfig, clearFileConfig,
  buildFromFields, CONFIG_FILE,
};
