-- ─────────────────────────────────────────────────────────────
-- CampusIQ Section Migration
-- Run once against your PostgreSQL database
-- ─────────────────────────────────────────────────────────────

-- 1. Add section column to users table (e.g. A, B, C, D)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS section TEXT;

-- 2. Add section column to documents so teacher can tag which section it's for
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS section TEXT;

-- 3. Add uploaded_by to documents (link to teacher's user id)
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS uploaded_by_id TEXT;

-- 4. Index for fast section-based document lookup
CREATE INDEX IF NOT EXISTS idx_documents_section ON documents(section);
CREATE INDEX IF NOT EXISTS idx_documents_dept_section ON documents(department, section);

SELECT 'Section migration complete ✅' AS status;
