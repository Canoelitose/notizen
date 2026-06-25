#!/usr/bin/env node
// Admin tool: create/reset users. Funktioniert in allen Varianten
// (Proxmox / Docker / Local) — DB-Config kommt aus db-config.js.
//   node admin-tool.js create EMAIL PASSWORD [--admin]
//   node admin-tool.js reset  EMAIL PASSWORD
//   node admin-tool.js list
// Konfiguration via DATABASE_URL oder DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASS
// (auch aus app/.env oder /etc/notes-app/env — siehe db-config.js).

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const crypto = require('crypto');
const db = require('./db-config');

db.autoload();
const pool = new Pool(db.poolConfig());

async function create(email, password, asAdmin) {
  if (!email || !password) { console.error('usage: create EMAIL PASSWORD [--admin]'); process.exit(2); }
  if (password.length < 8) { console.error('password too short (min 8)'); process.exit(2); }
  const hash = await bcrypt.hash(password, 12);
  const r = await pool.query(
    `INSERT INTO users (email, password_hash, is_admin) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_admin = EXCLUDED.is_admin
     RETURNING id, email, is_admin`,
    [email.toLowerCase().trim(), hash, !!asAdmin]
  );
  const user = r.rows[0];
  // Ensure seed folders + app_state exist
  await pool.query(
    `INSERT INTO app_state (user_id, state) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
    [user.id, { themePref: 'auto', selectedFolderId: 'all', selectedNoteId: null }]
  );
  const { rows: fc } = await pool.query('SELECT count(*)::int AS n FROM folders WHERE user_id = $1', [user.id]);
  if (fc[0].n === 0) {
    const seed = [
      { name: 'Server-Admin', icon: 'terminal' },
      { name: 'Projekte', icon: 'folder' },
      { name: 'Lernen & Snippets', icon: 'folder' },
      { name: 'Persönlich', icon: 'folder' },
    ];
    for (let i = 0; i < seed.length; i++) {
      await pool.query(
        'INSERT INTO folders (id, user_id, name, icon, position) VALUES ($1, $2, $3, $4, $5)',
        ['f-' + crypto.randomBytes(4).toString('hex'), user.id, seed[i].name, seed[i].icon, i]
      );
    }
  }
  console.log('OK', JSON.stringify(user));
}

async function reset(email, password) {
  if (!email || !password) { console.error('usage: reset EMAIL PASSWORD'); process.exit(2); }
  const hash = await bcrypt.hash(password, 12);
  const r = await pool.query(
    'UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id, email, is_admin',
    [hash, email.toLowerCase().trim()]
  );
  if (!r.rows[0]) { console.error('user not found'); process.exit(1); }
  console.log('OK', JSON.stringify(r.rows[0]));
}

async function list() {
  const r = await pool.query('SELECT id, email, is_admin, created_at FROM users ORDER BY created_at');
  console.log(JSON.stringify(r.rows, null, 2));
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  try {
    if (cmd === 'create') {
      const asAdmin = args.includes('--admin');
      await create(args[0], args[1], asAdmin);
    } else if (cmd === 'reset') {
      await reset(args[0], args[1]);
    } else if (cmd === 'list') {
      await list();
    } else {
      console.error('Commands: create EMAIL PASSWORD [--admin] | reset EMAIL PASSWORD | list');
      process.exit(2);
    }
  } finally {
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
