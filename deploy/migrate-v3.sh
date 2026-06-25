#!/bin/bash
# v3 schema migration: add folders.parent_id for hierarchical folders.
set -e
pct exec 105 -- su - postgres -c "psql -d notes_app -v ON_ERROR_STOP=1 -c \"
  ALTER TABLE folders ADD COLUMN IF NOT EXISTS parent_id TEXT;
\""
echo "=== folders schema ==="
pct exec 105 -- su - postgres -c "psql -d notes_app -c '\d folders'"
