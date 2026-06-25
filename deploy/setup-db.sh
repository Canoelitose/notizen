#!/bin/bash
set -e

DB_APP_PASS=$(grep '^DB_APP_PASS=' /root/notes-app/credentials.txt | cut -d= -f2)
if [ -z "$DB_APP_PASS" ]; then
  echo "DB_APP_PASS not found in credentials file" >&2
  exit 1
fi

echo "=== Configuring PostgreSQL on LXC 105 ==="

# Configure postgres to listen + allow web LXC
pct exec 105 -- bash -s <<'PCT'
set -e
sed -i "s/^#\?listen_addresses.*/listen_addresses = '*'/" /etc/postgresql/15/main/postgresql.conf
grep -q '10.10.11.104/32' /etc/postgresql/15/main/pg_hba.conf || \
  echo "host    notes_app    notes_app    10.10.11.104/32    scram-sha-256" >> /etc/postgresql/15/main/pg_hba.conf
systemctl restart postgresql
PCT

# Drop and recreate cleanly (idempotent)
pct exec 105 -- su - postgres -c "psql -v ON_ERROR_STOP=1" <<SQL
DROP DATABASE IF EXISTS notes_app;
DROP USER IF EXISTS notes_app;
CREATE USER notes_app WITH PASSWORD '${DB_APP_PASS}';
CREATE DATABASE notes_app OWNER notes_app;
GRANT ALL PRIVILEGES ON DATABASE notes_app TO notes_app;
SQL

pct exec 105 -- su - postgres -c "psql -d notes_app -v ON_ERROR_STOP=1" <<'SQL'
GRANT ALL ON SCHEMA public TO notes_app;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS folders (
  id           TEXT NOT NULL,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  icon         TEXT,
  position     INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS notes (
  id           TEXT NOT NULL,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id    TEXT,
  type         TEXT NOT NULL,
  pinned       BOOLEAN NOT NULL DEFAULT FALSE,
  data         JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  FOREIGN KEY (user_id, folder_id) REFERENCES folders(user_id, id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_user_updated ON notes(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS app_state (
  user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state        JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS sessions (
  token        TEXT PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

ALTER TABLE users OWNER TO notes_app;
ALTER TABLE folders OWNER TO notes_app;
ALTER TABLE notes OWNER TO notes_app;
ALTER TABLE app_state OWNER TO notes_app;
ALTER TABLE sessions OWNER TO notes_app;
SQL

echo "=== Verifying tables ==="
pct exec 105 -- su - postgres -c "psql -d notes_app -c '\dt'"

echo "=== Testing connection from web LXC (104) to DB LXC (105) ==="
pct exec 104 -- bash -c "command -v psql >/dev/null || (apt-get install -y -qq postgresql-client >/dev/null 2>&1)"
pct exec 104 -- bash -c "PGPASSWORD='${DB_APP_PASS}' psql -h 10.10.11.105 -U notes_app -d notes_app -c 'SELECT current_user, current_database();'"
echo "=== DB setup OK ==="
