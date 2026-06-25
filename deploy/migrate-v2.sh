#!/bin/bash
# Drop the composite FK from notes → folders. App maintains referential integrity
# via the transactional PUT /api/state.
set -e
pct exec 105 -- su - postgres -c "psql -d notes_app -v ON_ERROR_STOP=1 -c \"
  ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_user_id_folder_id_fkey;
\""
echo "=== FK dropped, current notes constraints ==="
pct exec 105 -- su - postgres -c "psql -d notes_app -c \"
  SELECT conname, contype FROM pg_constraint WHERE conrelid = 'notes'::regclass;
\""
