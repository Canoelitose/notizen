#!/usr/bin/env node
// init-db.js — legt das Schema an (idempotent) und optional einen Admin-User.
// Nutzbar als CLI (Docker-Entrypoint, Local-Setup) ODER als Modul (der
// GUI-Einrichtungsassistent in server.js ruft applySchema/ensureAdmin direkt auf).
//
//   node init-db.js
//
// DB-Config: siehe db-config.js. Admin (optional via CLI): ADMIN_EMAIL + ADMIN_PASS.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const db = require('./db-config');

const SCHEMA_FILE = process.env.SCHEMA_FILE || path.join(__dirname, '..', 'deploy', 'schema.sql');

async function waitForDb(pool, tries = 30, delayMs = 2000) {
  for (let i = 1; i <= tries; i++) {
    try { await pool.query('SELECT 1'); return; }
    catch (e) {
      console.log(`  warte auf Datenbank (${i}/${tries}) … ${e.code || e.message}`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('Datenbank nach mehreren Versuchen nicht erreichbar');
}

async function applySchema(pool) {
  let sql = fs.readFileSync(SCHEMA_FILE, 'utf8');
  // `CREATE EXTENSION pgcrypto` braucht Superuser-Rechte. Auf PostgreSQL 13+
  // ist gen_random_uuid() im Core enthalten — die Zeile ist also nicht nötig
  // und wird entfernt, damit init-db auch als normaler DB-Owner läuft.
  sql = sql.replace(/^\s*CREATE EXTENSION[^;]*;/gim, '');
  await pool.query(sql);
}

// Legt einen Admin-User samt Seed-Ordnern an, falls die E-Mail noch nicht
// existiert. Gibt true zurück, wenn neu angelegt.
async function ensureAdmin(pool, email, password) {
  if (!email || !password) return false;
  if (String(password).length < 8) throw new Error('Passwort zu kurz (min. 8 Zeichen)');

  const hash = await bcrypt.hash(password, 12);
  const r = await pool.query(
    `INSERT INTO users (email, password_hash, is_admin) VALUES ($1, $2, TRUE)
     ON CONFLICT (email) DO NOTHING RETURNING id`,
    [String(email).toLowerCase().trim(), hash]
  );
  if (!r.rows[0]) return false;

  const uid = r.rows[0].id;
  await pool.query(
    `INSERT INTO app_state (user_id, state) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
    [uid, { themePref: 'auto', selectedFolderId: 'all', selectedNoteId: null }]
  );
  const seed = [
    ['Server-Admin', 'terminal'], ['Projekte', 'folder'],
    ['Lernen & Snippets', 'folder'], ['Persönlich', 'folder'],
  ];
  for (let i = 0; i < seed.length; i++) {
    await pool.query(
      'INSERT INTO folders (id, user_id, name, icon, position) VALUES ($1, $2, $3, $4, $5)',
      ['f-' + crypto.randomBytes(4).toString('hex'), uid, seed[i][0], seed[i][1], i]
    );
  }
  return true;
}

// Anzahl vorhandener User (z.B. um zu entscheiden, ob ein Erst-Admin nötig ist).
async function userCount(pool) {
  const r = await pool.query('SELECT count(*)::int AS n FROM users');
  return r.rows[0].n;
}

// CLI-Lauf: wartet auf DB, Schema, optional Admin aus ADMIN_EMAIL/ADMIN_PASS.
async function main() {
  db.autoload();
  const pool = new Pool(db.poolConfig());
  console.log('init-db → Datenbank', db.describe());
  try {
    await waitForDb(pool);
    await applySchema(pool);
    console.log('Schema angewandt (idempotent).');
    const email = process.env.ADMIN_EMAIL, pass = process.env.ADMIN_PASS;
    if (email && pass) {
      const created = await ensureAdmin(pool, email, pass);
      console.log(created ? `Admin ${email} angelegt.` : `Admin ${email} existiert bereits.`);
    } else {
      console.log('Kein ADMIN_EMAIL/ADMIN_PASS — Admin-Anlage übersprungen.');
    }
    console.log('init-db fertig.');
  } finally {
    await pool.end();
  }
}

module.exports = { waitForDb, applySchema, ensureAdmin, userCount, SCHEMA_FILE };

if (require.main === module) {
  main().catch(e => { console.error('init-db fehlgeschlagen:', e.message); process.exit(1); });
}
