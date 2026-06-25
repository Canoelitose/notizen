#!/bin/bash
# Creates the first admin user. Runs on the Proxmox host, executes inside LXC 104.
set -e

ADMIN_EMAIL="$1"
ADMIN_PASS="$2"

if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASS" ]; then
  echo "Usage: $0 EMAIL PASSWORD" >&2; exit 1
fi

# Generate bcrypt hash inside the LXC (where bcrypt is installed)
HASH=$(pct exec 104 -- node -e "
  const bcrypt = require('/opt/notes-app/node_modules/bcrypt');
  bcrypt.hash(process.argv[1], 12).then(h => { process.stdout.write(h); });
" "$ADMIN_PASS")

if [ -z "$HASH" ]; then
  echo "Failed to generate hash" >&2; exit 1
fi

# Insert via psql on the DB LXC
DB_PASS=$(grep '^DB_APP_PASS=' /root/notes-app/credentials.txt | cut -d= -f2)

pct exec 105 -- su - postgres -c "psql -d notes_app -v ON_ERROR_STOP=1 <<SQL
INSERT INTO users (email, password_hash, is_admin)
VALUES ('${ADMIN_EMAIL}', '${HASH}', TRUE)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_admin = TRUE
RETURNING id, email, is_admin;
SQL"

# Seed folders for this user if they don't have any yet
NEW_USER_ID=$(pct exec 105 -- su - postgres -c "psql -d notes_app -t -A -c \"SELECT id FROM users WHERE email = '${ADMIN_EMAIL}';\"")

pct exec 105 -- su - postgres -c "psql -d notes_app -v ON_ERROR_STOP=1 <<SQL
INSERT INTO folders (id, user_id, name, icon, position)
SELECT v.id, '${NEW_USER_ID}', v.name, v.icon, v.position
FROM (VALUES
  ('f-' || substr(md5(random()::text), 1, 8), 'Server-Admin', 'terminal', 0),
  ('f-' || substr(md5(random()::text), 1, 8), 'Projekte', 'folder', 1),
  ('f-' || substr(md5(random()::text), 1, 8), 'Lernen & Snippets', 'folder', 2),
  ('f-' || substr(md5(random()::text), 1, 8), 'Persönlich', 'folder', 3)
) AS v(id, name, icon, position)
WHERE NOT EXISTS (SELECT 1 FROM folders WHERE user_id = '${NEW_USER_ID}');

INSERT INTO app_state (user_id, state)
VALUES ('${NEW_USER_ID}', '{"themePref":"auto","selectedFolderId":"all","selectedNoteId":null}'::jsonb)
ON CONFLICT (user_id) DO NOTHING;
SQL"

echo "=== Admin user created/updated: ${ADMIN_EMAIL} ==="
