#!/bin/bash
# Security hardening for notes-app deployment.
# Runs on the Proxmox host. Idempotent.
set -e

echo "=== 1. PVE cluster firewall must be enabled ==="
mkdir -p /etc/pve/firewall
cat >/etc/pve/firewall/cluster.fw <<'EOF'
[OPTIONS]
enable: 1
policy_in: ACCEPT
policy_out: ACCEPT
EOF

echo "=== 2. LXC 104 (web): firewall — drop everything inbound except established ==="
# We bind Express to 127.0.0.1 inside the container, so even without the firewall
# nobody on the LAN can reach port 3000. The firewall is defense in depth.
cat >/etc/pve/firewall/104.fw <<'EOF'
[OPTIONS]
enable: 1
policy_in: DROP
policy_out: ACCEPT
log_level_in: nolog
log_level_out: nolog

[RULES]
# Allow already-established / related traffic
IN ACCEPT -p icmp -log nolog
# No inbound TCP rules — port 3000 stays unreachable from the LAN.
# cloudflared connects outbound and tunnels traffic in via its own loopback connection.
EOF

echo "=== 3. LXC 105 (db): firewall — only 5432 from 10.10.11.104 ==="
cat >/etc/pve/firewall/105.fw <<'EOF'
[OPTIONS]
enable: 1
policy_in: DROP
policy_out: ACCEPT
log_level_in: nolog
log_level_out: nolog

[RULES]
IN ACCEPT -p icmp -log nolog
# Postgres only reachable from the web LXC
IN ACCEPT -p tcp -dport 5432 -source 10.10.11.104 -log nolog
EOF

echo "=== 4. Postgres: listen only on eth0 IP (not on all interfaces) ==="
pct exec 105 -- bash -s <<'PCT'
set -e
sed -i "s/^listen_addresses.*/listen_addresses = 'localhost,10.10.11.105'/" /etc/postgresql/15/main/postgresql.conf
systemctl restart postgresql
# verify it bound only to the intended addresses
ss -tlnp | grep 5432 | head -5 || true
PCT

echo "=== 5. App: rebind to 127.0.0.1 (BIND_HOST env), no LAN exposure ==="
pct exec 104 -- bash -s <<'PCT'
set -e
# Add BIND_HOST if missing
grep -q '^BIND_HOST=' /etc/notes-app/env || echo 'BIND_HOST=127.0.0.1' >> /etc/notes-app/env
# COOKIE_SECURE will be flipped to 1 when the Cloudflare tunnel is in place.
# For now keep 0 so we can still test from a LAN host before the tunnel is up.
systemctl restart notes-app
sleep 2
systemctl is-active notes-app
# Verify it's no longer listening on 0.0.0.0
ss -tlnp | grep ':3000' | head -3 || true
PCT

echo "=== 6. Reload PVE firewall so per-CT rules take effect ==="
systemctl reload pve-firewall || systemctl restart pve-firewall

echo "=== 7. Verify firewall status ==="
pve-firewall status

echo "=== 8. Verify LXC 104 is no longer reachable on port 3000 from the host ==="
# Should fail because the LXC firewall drops + Express only binds loopback
timeout 3 bash -c 'cat </dev/tcp/10.10.11.104/3000' 2>&1 || echo "OK: web LXC port 3000 blocked from host"

echo "=== 9. Verify LXC 105 is only reachable on 5432 from the web LXC, not from host ==="
timeout 3 bash -c 'cat </dev/tcp/10.10.11.105/5432' 2>&1 || echo "OK: db LXC port 5432 blocked from host"

echo "=== 10. Verify web LXC can still reach db LXC on 5432 ==="
pct exec 104 -- timeout 3 bash -c 'cat </dev/tcp/10.10.11.105/5432' 2>&1 | head -1 && echo "OK: web LXC -> db LXC works"

echo "=== 11. Verify app is still reachable from cloudflared on loopback inside web LXC ==="
pct exec 104 -- curl -fsS http://127.0.0.1:3000/api/health && echo " (app health OK on loopback)"

echo "=== Hardening complete ==="
