# DB über Cloudflare-Tunnel erreichen

Standard ist die DB-Verbindung **per IP** (`DB_HOST=10.10.11.105` o.ä.). Wenn die
App und die Datenbank aber in **verschiedenen Netzen** stehen (z.B. App lokal /
in der Cloud, DB zu Hause hinter einem Router ohne Portfreigabe), kann die
PostgreSQL-Verbindung durch einen **Cloudflare-Tunnel** getunnelt werden — ohne
offenen Port nach aussen.

```
  App  ──TCP 127.0.0.1:5432──►  cloudflared access (Client)
                                      │  verschlüsselter Tunnel (QUIC)
                                      ▼
                                Cloudflare Edge
                                      │
                                cloudflared (Server, bei der DB)
                                      ▼
                                PostgreSQL  localhost:5432
```

## 1. Serverseite (dort, wo PostgreSQL läuft)

`cloudflared` installieren und einen Tunnel mit **TCP-Ingress** auf Postgres legen.
In der Tunnel-Konfiguration (`~/.cloudflared/config.yml` bzw. im Dashboard):

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json
ingress:
  - hostname: db.example.com
    service: tcp://localhost:5432
  - service: http_status:404
```

DNS-Route anlegen:

```bash
cloudflared tunnel route dns <TUNNEL_NAME> db.example.com
cloudflared tunnel run <TUNNEL_NAME>
```

**Empfohlen:** den Hostnamen mit einer **Cloudflare-Access-Policy (Self-hosted,
TCP)** schützen und ein **Service-Token** erstellen — sonst wäre der DB-Endpunkt
für jeden erreichbar, der den Hostnamen kennt (Postgres-Auth schützt zwar, aber
Access ist die zusätzliche Schicht).

## 2. Clientseite (dort, wo die App läuft)

`cloudflared` öffnet einen lokalen Port, der zur entfernten DB führt:

- **Linux/Proxmox:**  `bash deploy/db-tunnel/db-tunnel.sh db.example.com`
- **Windows/Local:**   `powershell -File deploy\db-tunnel\db-tunnel.ps1 -Hostname db.example.com`
- **Docker:**          Profil `tunnel-db` (siehe `docker-compose.yml` / `.env.docker.example`)

Danach zeigt die App-Verbindung auf den lokalen Tunnel-Port:

```ini
# in app/.env bzw. der jeweiligen env
DB_HOST=127.0.0.1
DB_PORT=5432
# oder als URL:
DATABASE_URL=postgres://notes_app:PASS@127.0.0.1:5432/notes_app
```

Liegt der Tunnel hinter Cloudflare Access, beim Client das Service-Token
mitgeben (Parameter `-ClientId/-ClientSecret` bzw. die Flags `--service-token-id`
/ `--service-token-secret`).
