// Notes App — Express server with auth + per-user note storage
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const db = require('./db-config');
const initDb = require('./init-db');

// Secrets/Config aus einer env-Datei nachladen (app/.env, /etc/notes-app/env …),
// ohne bereits gesetzte Umgebungsvariablen zu überschreiben.
db.autoload();

const cfg = {
  port: parseInt(process.env.PORT || '3000', 10),
  // Default: nur Loopback binden (nichts im LAN erreicht Express direkt;
  // cloudflared verbindet sich über 127.0.0.1). Für Docker BIND_HOST=0.0.0.0.
  bindHost: process.env.BIND_HOST || '127.0.0.1',
  cookieSecure: process.env.COOKIE_SECURE === '1',
};

// Der DB-Pool wird ERST erstellt, wenn eine Konfiguration existiert (env oder
// db-connection.json). Ohne Config zeigt der Server den Einrichtungs-Assistenten
// (/setup). Verbindung aus DATABASE_URL ODER DB_HOST/DB_PORT/… (per IP/Tunnel).
let pool = null;
function initPool() { pool = new Pool(db.poolConfig()); return pool; }
if (db.isConfigured()) initPool();

// Sicherheit: Auf einer NICHT-Loopback-Adresse darf der unkonfigurierte Assistent
// nicht offen stehen (sonst könnte jeder im LAN die Instanz übernehmen + Admin
// anlegen). Dann ist ein Setup-Token nötig, das beim Start ausgegeben wird.
function isLoopbackHost(h) {
  return h === '127.0.0.1' || h === '::1' || h === 'localhost' || h === '::ffff:127.0.0.1';
}
const setupToken = (!db.isConfigured() && !isLoopbackHost(cfg.bindHost))
  ? crypto.randomBytes(9).toString('base64url') : null;

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_COOKIE = 'notes_sid';

// ---- Helpers ----
const newToken = () => crypto.randomBytes(32).toString('base64url');

async function loadSession(token) {
  if (!token || !pool) return null;
  const { rows } = await pool.query(
    `SELECT s.user_id, u.email, u.is_admin
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );
  return rows[0] || null;
}

async function requireAuth(req, res, next) {
  if (!pool) return res.status(503).json({ error: 'not configured', code: 'not_configured' });
  const token = req.cookies[SESSION_COOKIE];
  const sess = await loadSession(token);
  if (!sess) return res.status(401).json({ error: 'unauthorized' });
  req.user = sess;
  next();
}

async function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) return res.status(403).json({ error: 'admin only' });
  next();
}

function seedState() {
  const uid = () => crypto.randomBytes(6).toString('hex');
  return {
    folders: [
      { id: 'f-' + uid(), name: 'Server-Admin', icon: 'terminal', position: 0 },
      { id: 'f-' + uid(), name: 'Projekte', icon: 'folder', position: 1 },
      { id: 'f-' + uid(), name: 'Lernen & Snippets', icon: 'folder', position: 2 },
      { id: 'f-' + uid(), name: 'Persönlich', icon: 'folder', position: 3 },
    ],
    notes: [],
    ui: { themePref: 'auto', selectedFolderId: 'all', selectedNoteId: null },
  };
}

// ---- Login rate limiting (in-memory, sliding window per IP) ----
const LOGIN_LIMIT = { max: 5, windowMs: 60_000 };
const loginAttempts = new Map(); // ip -> [timestamps]
function clientIp(req) {
  // trust proxy is enabled below, so req.ip honors X-Forwarded-For from cloudflared
  return req.ip || req.socket.remoteAddress || 'unknown';
}
function rateLimitLogin(req, res, next) {
  const ip = clientIp(req);
  const now = Date.now();
  const recent = (loginAttempts.get(ip) || []).filter(t => now - t < LOGIN_LIMIT.windowMs);
  if (recent.length >= LOGIN_LIMIT.max) {
    return res.status(429).json({ error: 'too many login attempts, try again later' });
  }
  recent.push(now);
  loginAttempts.set(ip, recent);
  next();
}

// ---- App ----
const app = express();
// We're behind cloudflared on loopback — trust the X-Forwarded-* it sends.
app.set('trust proxy', 'loopback');
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// Security headers (applied everywhere, even /login)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'same-origin');
  if (cfg.cookieSecure) {
    // HSTS — only set when we know traffic is HTTPS (i.e. behind the tunnel)
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Login page (static) — ohne DB-Config zuerst zur Einrichtung.
app.get('/login', (req, res) => {
  if (!db.isConfigured()) return res.redirect('/setup');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// ---- Einrichtungs-Assistent (GUI) — nur aktiv, solange NICHT konfiguriert ----
// Docker/Proxmox setzen die DB per env -> isConfigured() = true -> /setup ist
// dort nie erreichbar. Bei Remote-Bind ohne Config ist ein Setup-Token nötig.
const SETUP_PAGE = path.join(__dirname, 'public', 'setup.html');

app.get('/setup', (req, res) => {
  if (db.isConfigured()) return res.redirect('/');
  res.sendFile(SETUP_PAGE);
});

app.get('/api/setup/status', (req, res) => {
  res.json({ configured: db.isConfigured(), tokenRequired: !!setupToken });
});

function setupGuard(req, res, next) {
  if (db.isConfigured()) return res.status(409).json({ error: 'bereits konfiguriert', code: 'configured' });
  if (setupToken) {
    const t = req.get('X-Setup-Token') || (req.body && req.body.token);
    if (t !== setupToken) return res.status(403).json({ error: 'Setup-Token erforderlich', code: 'token' });
  }
  next();
}

// Wizard-Eingaben (URL oder Einzelfelder) -> normalisiertes Config-Objekt.
function configFromBody(b) {
  if (b && b.url) return { url: String(b.url).trim() };
  return {
    host: String(b.host || '').trim(),
    port: Number(b.port || 5432),
    name: String(b.name || 'notes_app').trim(),
    user: String(b.user || 'notes_app').trim(),
    pass: b.pass != null ? String(b.pass) : '',
    ssl: !!b.ssl,
  };
}

// Verbindung testen (ohne zu speichern).
app.post('/api/setup/test', setupGuard, async (req, res) => {
  const cfgObj = configFromBody(req.body || {});
  const testPool = new Pool({ ...db.buildFromFields(cfgObj, 1), connectionTimeoutMillis: 6000 });
  try {
    await testPool.query('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: e.message, code: e.code || null });
  } finally {
    testPool.end().catch(() => {});
  }
});

// Speichern + einrichten: Verbindung prüfen, Schema anlegen, optional Erst-Admin,
// Config persistieren, Haupt-Pool aktivieren.
app.post('/api/setup/save', setupGuard, async (req, res) => {
  const b = req.body || {};
  const cfgObj = configFromBody(b);
  const testPool = new Pool({ ...db.buildFromFields(cfgObj, 2), connectionTimeoutMillis: 6000 });
  try {
    await testPool.query('SELECT 1');
    await initDb.applySchema(testPool);
    let adminCreated = false;
    if (b.adminEmail && b.adminPass) {
      adminCreated = await initDb.ensureAdmin(testPool, b.adminEmail, b.adminPass);
    }
    const users = await initDb.userCount(testPool);
    // Sackgasse vermeiden: erst speichern, wenn es mind. ein Login gibt.
    if (users === 0) {
      return res.status(400).json({
        ok: false, code: 'need_admin',
        error: 'Die Datenbank hat noch kein Konto — bitte Login (E-Mail + Passwort min. 8) anlegen.',
      });
    }
    db.saveFileConfig(cfgObj);
    initPool();
    res.json({ ok: true, adminCreated, users });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message, code: e.code || null });
  } finally {
    testPool.end().catch(() => {});
  }
});

// ---- Auth endpoints ----
app.post('/api/login', rateLimitLogin, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const { rows } = await pool.query('SELECT id, password_hash, is_admin FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'invalid credentials' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });
  const token = newToken();
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await pool.query('INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)', [token, user.id, expires]);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: cfg.cookieSecure,
    expires, path: '/',
  });
  res.json({ ok: true, isAdmin: user.is_admin });
});

app.post('/api/logout', async (req, res) => {
  const token = req.cookies[SESSION_COOKIE];
  if (token) await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

app.get('/api/me', async (req, res) => {
  const token = req.cookies[SESSION_COOKIE];
  const sess = await loadSession(token);
  if (!sess) return res.status(401).json({ error: 'unauthorized' });
  res.json({ email: sess.email, isAdmin: sess.is_admin });
});

// ---- Per-user data snapshots (defense against accidental wipes) ----
// Before any destructive /api/state write we dump the user's current notes +
// folders + app_state to a JSON file and keep the last SNAP_KEEP of them.
// Beschreibbares Datenverzeichnis. In der installierten Desktop-App (Electron)
// liegt der Code schreibgeschützt im Programmordner -> NOTES_DATA_DIR zeigt dann
// auf einen beschreibbaren Pfad (AppData). Default: neben dem Code.
const DATA_DIR = process.env.NOTES_DATA_DIR || __dirname;
const SNAP_DIR = path.join(DATA_DIR, 'snapshots');
const SNAP_KEEP = 30;
try { fs.mkdirSync(SNAP_DIR, { recursive: true }); } catch (e) {}

async function snapshotUserData(uid) {
  const [f, n, s] = await Promise.all([
    pool.query('SELECT id,name,icon,parent_id,position FROM folders WHERE user_id=$1', [uid]),
    pool.query('SELECT id,folder_id,type,pinned,data,created_at,updated_at FROM notes WHERE user_id=$1', [uid]),
    pool.query('SELECT state FROM app_state WHERE user_id=$1', [uid]),
  ]);
  // Don't bother snapshotting an already-empty account (nothing to lose).
  if (f.rows.length === 0 && n.rows.length === 0) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(SNAP_DIR, `${uid}_${stamp}.json`);
  fs.writeFileSync(file, JSON.stringify({ uid, at: new Date().toISOString(), folders: f.rows, notes: n.rows, app_state: s.rows[0]?.state || {} }));
  // Rotate: keep newest SNAP_KEEP per user
  const mine = fs.readdirSync(SNAP_DIR).filter(x => x.startsWith(uid + '_')).sort();
  for (const old of mine.slice(0, Math.max(0, mine.length - SNAP_KEEP))) {
    try { fs.unlinkSync(path.join(SNAP_DIR, old)); } catch (e) {}
  }
}

// List available snapshots (admin/self) — for manual recovery
app.get('/api/snapshots', requireAuth, async (req, res) => {
  const uid = req.user.user_id;
  const list = fs.readdirSync(SNAP_DIR)
    .filter(x => x.startsWith(uid + '_'))
    .sort().reverse()
    .map(name => {
      const st = fs.statSync(path.join(SNAP_DIR, name));
      let counts = {};
      try { const j = JSON.parse(fs.readFileSync(path.join(SNAP_DIR, name), 'utf8')); counts = { notes: j.notes.length, folders: j.folders.length }; } catch (e) {}
      return { name, size: st.size, at: st.mtime, ...counts };
    });
  res.json({ snapshots: list });
});

// ---- State endpoints ----
app.get('/api/state', requireAuth, async (req, res) => {
  const uid = req.user.user_id;
  const [foldersRes, notesRes, stateRes] = await Promise.all([
    pool.query('SELECT id, name, icon, parent_id, position FROM folders WHERE user_id = $1 ORDER BY position, name', [uid]),
    pool.query(`SELECT id, folder_id, type, pinned, data,
                       extract(epoch from created_at) * 1000 AS created_ms,
                       extract(epoch from updated_at) * 1000 AS updated_ms
                FROM notes WHERE user_id = $1 ORDER BY updated_at DESC`, [uid]),
    pool.query('SELECT state FROM app_state WHERE user_id = $1', [uid]),
  ]);

  const folders = foldersRes.rows.map(r => ({ id: r.id, name: r.name, icon: r.icon, parentId: r.parent_id }));
  const notes = notesRes.rows.map(r => ({
    ...r.data,
    id: r.id,
    folderId: r.folder_id,
    type: r.type,
    pinned: r.pinned,
    createdAt: new Date(Number(r.created_ms)).toISOString(),
    updatedAt: new Date(Number(r.updated_ms)).toISOString(),
  }));
  const ui = stateRes.rows[0]?.state || {};

  res.json({
    folders,
    notes,
    templates: Array.isArray(ui.templates) ? ui.templates : [],
    trash: Array.isArray(ui.trash) ? ui.trash : [],
    themePref: ui.themePref || 'auto',
    selectedFolderId: ui.selectedFolderId || 'dashboard',
    selectedNoteId: ui.selectedNoteId || null,
  });
});

app.put('/api/state', requireAuth, async (req, res) => {
  const uid = req.user.user_id;
  const body = req.body || {};
  const folders = Array.isArray(body.folders) ? body.folders : [];
  const notes = Array.isArray(body.notes) ? body.notes : [];

  // ---- SAFETY GUARD against accidental data loss ----------------------------
  // A bug class (failed initial load → app saves an empty state) was wiping all
  // notes. Refuse a destructive write: if the incoming payload is empty but the
  // DB currently holds data, reject it unless the client explicitly confirms
  // with ?allowEmpty=1 (used by the in-app "delete everything" action).
  const allowEmpty = req.query.allowEmpty === '1';
  if (!allowEmpty && notes.length === 0 && folders.length === 0) {
    const { rows } = await pool.query(
      'SELECT (SELECT count(*) FROM notes WHERE user_id=$1) n, (SELECT count(*) FROM folders WHERE user_id=$1) f',
      [uid]
    );
    if (Number(rows[0].n) > 0 || Number(rows[0].f) > 0) {
      console.warn(`BLOCKED empty-state overwrite for user ${uid} (db has ${rows[0].n} notes, ${rows[0].f} folders)`);
      return res.status(409).json({ error: 'refused: empty payload would wipe existing data', code: 'empty_guard' });
    }
  }

  // Auto-snapshot before any destructive replace — keeps the last N dumps per
  // user on disk so a bad write is always recoverable.
  try { await snapshotUserData(uid); } catch (e) { console.warn('snapshot failed (continuing):', e.message); }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Delete notes first — avoids tripping the composite FK on the folders DELETE below
    await client.query('DELETE FROM notes WHERE user_id = $1', [uid]);

    // Replace folders. parent_id is a self-reference within this user's folders;
    // insertion order matches input so children referencing earlier parents is fine
    // (parent_id has no FK in the DB — app maintains integrity).
    await client.query('DELETE FROM folders WHERE user_id = $1', [uid]);
    for (let i = 0; i < folders.length; i++) {
      const f = folders[i];
      if (!f.id || !f.name) continue;
      await client.query(
        'INSERT INTO folders (id, user_id, name, icon, parent_id, position) VALUES ($1, $2, $3, $4, $5, $6)',
        [
          String(f.id), uid,
          String(f.name).slice(0, 200),
          f.icon ? String(f.icon).slice(0, 60) : null,
          f.parentId ? String(f.parentId) : null,
          i,
        ]
      );
    }

    // Now insert notes (folders are in place, FK references valid)
    for (const n of notes) {
      if (!n.id) continue;
      const { id, folderId, type, pinned, createdAt, updatedAt, ...rest } = n;
      const created = createdAt ? new Date(createdAt) : new Date();
      const updated = updatedAt ? new Date(updatedAt) : new Date();
      await client.query(
        `INSERT INTO notes (id, user_id, folder_id, type, pinned, data, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [String(id), uid, folderId ? String(folderId) : null, String(type || 'normal'), !!pinned, rest, created, updated]
      );
    }

    // Upsert UI state — templates and trash both ride along as JSONB.
    const ui = {
      themePref: body.themePref || 'auto',
      selectedFolderId: body.selectedFolderId || 'dashboard',
      selectedNoteId: body.selectedNoteId || null,
      templates: Array.isArray(body.templates) ? body.templates : [],
      trash:     Array.isArray(body.trash)     ? body.trash     : [],
    };
    await client.query(
      `INSERT INTO app_state (user_id, state) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET state = EXCLUDED.state`,
      [uid, ui]
    );

    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PUT /api/state failed:', err);
    res.status(500).json({ error: 'save failed' });
  } finally {
    client.release();
  }
});

// ---- Admin endpoints ----
app.get('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await pool.query('SELECT id, email, is_admin, created_at FROM users ORDER BY created_at');
  res.json({ users: rows });
});

app.post('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  const { email, password, isAdmin } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'password too short (min 8)' });
  const normalized = String(email).toLowerCase().trim();
  const hash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (email, password_hash, is_admin) VALUES ($1, $2, $3) RETURNING id, email, is_admin',
      [normalized, hash, !!isAdmin]
    );
    const newUser = rows[0];
    await pool.query('INSERT INTO app_state (user_id, state) VALUES ($1, $2)', [
      newUser.id, { themePref: 'auto', selectedFolderId: 'all', selectedNoteId: null },
    ]);
    // Seed folders
    const seed = seedState();
    for (let i = 0; i < seed.folders.length; i++) {
      const f = seed.folders[i];
      await pool.query(
        'INSERT INTO folders (id, user_id, name, icon, position) VALUES ($1, $2, $3, $4, $5)',
        [f.id, newUser.id, f.name, f.icon, i]
      );
    }
    res.json({ user: newUser });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'email already exists' });
    console.error(err);
    res.status(500).json({ error: 'create failed' });
  }
});

app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  if (req.params.id === req.user.user_id) return res.status(400).json({ error: 'cannot delete yourself' });
  await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ---- Office → PDF conversion (LibreOffice headless) ----
// Renders PowerPoint (and any office format) to PDF for high-fidelity preview.
// Conversions are serialized (LibreOffice keeps a single profile + is RAM-heavy)
// and the result is cached in memory by content hash so re-opening is instant.
const officeCache = new Map(); // sha256 -> Buffer(pdf) (hot in-memory)
const OFFICE_CACHE_MAX = 24;
const OFFICE_CACHE_DIR = path.join(DATA_DIR, 'cache', 'office'); // persistent across restarts
try { fs.mkdirSync(OFFICE_CACHE_DIR, { recursive: true }); } catch (e) {}
let _convChain = Promise.resolve();

function officeDiskPath(hash) { return path.join(OFFICE_CACHE_DIR, hash + '.pdf'); }

// Fast path: convert against the warm unoserver instance (no LibreOffice cold
// start). Falls back to spawning a fresh soffice if unoserver is unavailable.
const UNOSERVER_PORT = '2003';

function convertViaUnoserver(inFile, outFile) {
  return new Promise((resolve, reject) => {
    execFile('/usr/local/bin/unoconvert', [
      '--convert-to', 'pdf',
      '--host', '127.0.0.1', '--port', UNOSERVER_PORT,
      inFile, outFile,
    ], { timeout: 90000 }, (err) => {
      if (err) return reject(err);
      if (!fs.existsSync(outFile)) return reject(new Error('unoconvert produced no PDF'));
      resolve();
    });
  });
}

function convertViaSoffice(tmpDir, inFile, outFile) {
  return new Promise((resolve, reject) => {
    execFile('soffice', [
      '--headless', '--norestore', '--nolockcheck', '--nodefault',
      '-env:UserInstallation=file://' + path.join(tmpDir, 'profile'),
      '--convert-to', 'pdf', '--outdir', tmpDir, inFile,
    ], { timeout: 90000, env: { ...process.env, HOME: tmpDir } }, (err) => {
      if (!fs.existsSync(outFile)) return reject(err || new Error('no PDF produced'));
      resolve();
    });
  });
}

async function convertOfficeToPdf(data, ext) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lo-'));
  const cleanExt = String(ext || 'pptx').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'pptx';
  const inFile = path.join(tmpDir, 'in.' + cleanExt);
  const outFile = path.join(tmpDir, 'in.pdf');
  try {
    fs.writeFileSync(inFile, data);
    try {
      await convertViaUnoserver(inFile, outFile);     // warm path (~0.5-1s)
    } catch (e) {
      console.warn('unoserver convert failed, falling back to soffice:', e.message);
      await convertViaSoffice(tmpDir, inFile, outFile); // cold path (~2-4s)
    }
    return fs.readFileSync(outFile);
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
  }
}

app.post('/api/convert/office', requireAuth, express.raw({ type: '*/*', limit: '60mb' }), async (req, res) => {
  const data = req.body;
  if (!data || !data.length) return res.status(400).json({ error: 'no file' });
  const ext = req.query.ext || 'pptx';
  const hash = crypto.createHash('sha256').update(data).digest('hex');

  // 1) hot in-memory cache
  if (officeCache.has(hash)) {
    res.type('application/pdf');
    res.set('Cache-Control', 'private, max-age=3600');
    return res.send(officeCache.get(hash));
  }
  // 2) persistent disk cache (survives app restarts)
  try {
    const disk = officeDiskPath(hash);
    if (fs.existsSync(disk)) {
      const pdf = fs.readFileSync(disk);
      officeCache.set(hash, pdf);
      res.type('application/pdf');
      res.set('Cache-Control', 'private, max-age=3600');
      return res.send(pdf);
    }
  } catch (e) {}

  // 3) convert (serialized to avoid LibreOffice contention / RAM spikes)
  _convChain = _convChain.then(async () => {
    if (officeCache.has(hash)) return officeCache.get(hash); // filled while queued
    const pdf = await convertOfficeToPdf(data, ext);
    officeCache.set(hash, pdf);
    if (officeCache.size > OFFICE_CACHE_MAX) {
      officeCache.delete(officeCache.keys().next().value);
    }
    try { fs.writeFileSync(officeDiskPath(hash), pdf); } catch (e) {}
    return pdf;
  });

  try {
    const pdf = await _convChain;
    res.type('application/pdf');
    res.set('Cache-Control', 'private, max-age=3600');
    res.send(pdf);
  } catch (err) {
    console.error('office convert failed:', err.message);
    res.status(500).json({ error: 'conversion failed' });
  }
});

// ---- Static files ----
// Prefer the pre-compiled index (no in-browser Babel) if the build ran.
// Delete public/index.prod.html to instantly roll back to the Babel version.
const PROD_INDEX = path.join(__dirname, 'public', 'index.prod.html');
const INDEX_FILE = fs.existsSync(PROD_INDEX) ? PROD_INDEX : path.join(__dirname, 'public', 'index.html');

// Ohne DB-Config zuerst der Einrichtungs-Assistent; sonst SPA hinter Auth.
app.get('/', async (req, res, next) => {
  if (!db.isConfigured()) return res.redirect('/setup');
  const sess = await loadSession(req.cookies[SESSION_COOKIE]);
  if (!sess) return res.redirect('/login');
  res.sendFile(INDEX_FILE);
});

// PWA: manifest needs the correct MIME type or Chrome complains.
app.get('/manifest.json', (req, res) => {
  res.type('application/manifest+json');
  res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});

// PWA: service worker must never be cached by intermediaries, and needs the
// Service-Worker-Allowed header so it can claim scope "/" even when served
// from the same path. Anyone can fetch it (no auth required) — it only
// intercepts requests in the browser, doesn't expose data.
app.get('/service-worker.js', (req, res) => {
  res.type('application/javascript');
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Service-Worker-Allowed', '/');
  res.sendFile(path.join(__dirname, 'public', 'service-worker.js'));
});

app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ---- Health ----
app.get('/api/health', async (req, res) => {
  if (!db.isConfigured()) return res.json({ ok: false, code: 'not_configured' });
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(503).json({ ok: false, code: 'db_unreachable', error: 'db unreachable' });
  }
});

// PORT=0 -> Betriebssystem wählt einen garantiert freien Port (für die Desktop-
// App genutzt, umgeht belegte/„reservierte" Ports unter Windows). Der tatsächlich
// gebundene Port wird in eine Datei geschrieben, damit Electron ihn kennt.
function onListening(srv) {
  const actualPort = srv.address().port;
  try { fs.writeFileSync(path.join(DATA_DIR, 'runtime-port'), String(actualPort)); } catch (e) {}
  if (!db.isConfigured()) {
    console.log(`notes-app listening on ${cfg.bindHost}:${actualPort} — noch NICHT eingerichtet.`);
    console.log(`  -> Einrichtung im Browser: http://localhost:${actualPort}/setup`);
    if (setupToken) console.log(`  -> Setup-Token (für Zugriff von aussen nötig): ${setupToken}`);
  } else {
    console.log(`notes-app listening on ${cfg.bindHost}:${actualPort}, db ${db.describe()}`);
  }
}

const httpServer = app.listen(cfg.port, cfg.bindHost, () => onListening(httpServer));
httpServer.on('error', (e) => {
  // Sauberes Beenden statt unbehandeltem Absturz (z.B. „A JavaScript error occurred").
  console.error(`Server-Listen-Fehler auf ${cfg.bindHost}:${cfg.port}: ${e.code || e.message}`);
  process.exitCode = 1;
});
