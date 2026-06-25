# syntax=docker/dockerfile:1
# Notes-App — Container-Image. Mehrstufig: im Builder werden Abhängigkeiten
# (inkl. nativem bcrypt) installiert und das JSX-Frontend vorkompiliert; das
# Runtime-Image bleibt schlank. LibreOffice/Office-Vorschau ist optional.
#
#   docker build -t notes-app .                         # schlank (~250 MB)
#   docker build --build-arg INCLUDE_OFFICE=true -t notes-app:full .   # mit Office (~1.5 GB)

# ---- Build-Stage --------------------------------------------------------------
FROM node:20-bookworm AS builder
WORKDIR /app
COPY app/package*.json ./
RUN npm install --no-audit --no-fund
COPY app/ ./
# JSX -> dist + index.prod.html, danach Dev-Abhängigkeiten (Babel) entfernen.
RUN node build-jsx.js && npm prune --omit=dev

# ---- Runtime-Stage ------------------------------------------------------------
FROM node:20-bookworm-slim AS runtime
ARG INCLUDE_OFFICE=false
ENV NODE_ENV=production \
    PORT=3000 \
    BIND_HOST=0.0.0.0 \
    INCLUDE_OFFICE=${INCLUDE_OFFICE}

# tini als sauberes PID 1 (Signal-Handling, Zombie-Reaping).
RUN apt-get update && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*

# Optional: LibreOffice + unoserver für Office->PDF (server-seitige Vorschau).
RUN if [ "$INCLUDE_OFFICE" = "true" ]; then \
      apt-get update && apt-get install -y --no-install-recommends \
        libreoffice-impress libreoffice-writer libreoffice-calc \
        python3 python3-uno python3-pip fonts-dejavu fonts-liberation && \
      pip3 install --no-cache-dir --break-system-packages unoserver && \
      apt-get clean && rm -rf /var/lib/apt/lists/*; \
    fi

WORKDIR /app
COPY --from=builder /app ./
# init-db.js erwartet das Schema unter ../deploy/schema.sql (relativ zu /app).
COPY deploy/schema.sql /deploy/schema.sql
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p /app/cache/office /app/snapshots

# Laufzeit-Daten auslagerbar (Office-Cache + Sicherungs-Snapshots).
VOLUME ["/app/cache", "/app/snapshots"]

EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
