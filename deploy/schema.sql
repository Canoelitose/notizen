-- Notizen-App — finales DB-Schema (Stand inkl. aller Migrationen).
-- Idempotent: kann auf eine frische notes_app-DB angewendet werden.
-- Wird von provision.sh als DB-User notes_app eingespielt.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ordner mit Hierarchie (parent_id self-reference, kein FK — App garantiert Konsistenz)
CREATE TABLE IF NOT EXISTS folders (
  id          TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  icon        TEXT,
  parent_id   TEXT,
  position    INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);

-- Notizen — alle inhaltlichen Felder als JSONB in `data`.
-- BEWUSST kein composite-FK auf folders (hat in v1 beim Folder-Delete 500er verursacht).
CREATE TABLE IF NOT EXISTS notes (
  id          TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  folder_id   TEXT,
  type        TEXT NOT NULL,
  pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, id)
);
CREATE INDEX IF NOT EXISTS idx_notes_user_updated ON notes(user_id, updated_at DESC);

-- UI-State + templates + trash (als JSONB) pro User
CREATE TABLE IF NOT EXISTS app_state (
  user_id  UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state    JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
