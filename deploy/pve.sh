#!/bin/bash
# pve.sh "command" — run a command on the Proxmox host via plink (PuTTY).
#
# Secrets are read from the environment so they are never committed. Copy
# .env.example to .env, fill it in, and `source deploy/.env` before use:
#
#   source deploy/.env
#   ./deploy/pve.sh 'pct list'
#
# Required env vars:
#   PVE_HOST     Proxmox host IP/hostname (e.g. 10.10.11.111)
#   PVE_USER     SSH user (usually root)
#   PVE_PASS     SSH password
#   PVE_HOSTKEY  Host key fingerprint, e.g. SHA256:xxxxxxxx...
: "${PVE_HOST:?set PVE_HOST}"
: "${PVE_USER:?set PVE_USER}"
: "${PVE_PASS:?set PVE_PASS}"
: "${PVE_HOSTKEY:?set PVE_HOSTKEY}"

exec plink -ssh -batch \
  -pw "$PVE_PASS" \
  -hostkey "$PVE_HOSTKEY" \
  "$PVE_USER@$PVE_HOST" "$@"
