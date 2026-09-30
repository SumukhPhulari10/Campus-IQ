-- ─────────────────────────────────────────────────────────────
-- CampusIQ Documents Migration: Persistent document storage
-- Run once against your PostgreSQL database
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
  id              TEXT        PRIMARY KEY,
  title           TEXT        NOT NULL,
  department      TEXT        NOT NULL DEFAULT 'General Academic',
  category        TEXT        NOT NULL DEFAULT 'Circular',
  academic_year   TEXT        NOT NULL DEFAULT '2024-2025',
  published_date  TEXT,
  file_type       TEXT        NOT NULL DEFAULT 'pdf',
  file_size       TEXT        NOT NULL DEFAULT '1.0 MB',
  status          TEXT        NOT NULL DEFAULT 'indexed',
  total_chunks    INTEGER     NOT NULL DEFAULT 4,
  summary         TEXT,
  content_raw     TEXT,
  uploaded_by     UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_department ON documents(department);

SELECT 'Documents migration complete ✅' AS status;
