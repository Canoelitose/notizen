#!/bin/bash
# Run on the Proxmox host. Deploys /tmp/notes-app.tar.gz into LXC 104.
set -e

DB_APP_PASS=$(grep '^DB_APP_PASS=' /root/notes-app/credentials.txt | cut -d= -f2)
SESSION_SECRET=$(openssl rand -hex 24)

if [ -z "$DB_APP_PASS" ]; then
  echo "DB_APP_PASS missing" >&2; exit 1
fi

echo "=== Pushing app bundle into LXC 104 ==="
pct push 104 /tmp/notes-app.tar.gz /tmp/notes-app.tar.gz

echo "=== Installing on LXC 104 ==="
pct exec 104 -- bash -s <<'PCT'
set -e
export DEBIAN_FRONTEND=noninteractive

# Create system user
id notesapp >/dev/null 2>&1 || useradd --system --home /opt/notes-app --shell /usr/sbin/nologin notesapp

# Extract app
mkdir -p /opt/notes-app /etc/notes-app
tar -xzf /tmp/notes-app.tar.gz -C /opt/notes-app
rm /tmp/notes-app.tar.gz

# Install service unit
mv /opt/notes-app/notes-app.service /etc/systemd/system/notes-app.service

# Install node deps
cd /opt/notes-app
npm install --omit=dev --no-audit --no-fund 2>&1 | tail -5

chown -R notesapp:notesapp /opt/notes-app
PCT

echo "=== Writing env file with secrets ==="
pct exec 104 -- bash -c "cat >/etc/notes-app/env <<EOF
NODE_ENV=production
PORT=3000
DB_HOST=10.10.11.105
DB_NAME=notes_app
DB_USER=notes_app
DB_PASS=${DB_APP_PASS}
COOKIE_SECURE=0
EOF
chmod 600 /etc/notes-app/env"

echo "=== Enabling and starting service ==="
pct exec 104 -- bash -c "systemctl daemon-reload && systemctl enable --now notes-app.service && sleep 2 && systemctl is-active notes-app && curl -s http://127.0.0.1:3000/api/health"
echo
echo "=== Deployment complete ==="
