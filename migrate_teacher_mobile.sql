-- ─────────────────────────────────────────────────────────────
-- CampusIQ: Run this in pgAdmin → Query Tool
-- Paste ALL lines and press F5 (Execute)
-- ─────────────────────────────────────────────────────────────

-- 1. Make email column nullable (students/admins without email can still register)
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- 2. Add phone index for fast login by mobile number
CREATE INDEX IF NOT EXISTS idx_users_phone
  ON users(phone_number)
  WHERE phone_number IS NOT NULL;

-- Done!
SELECT 'Migration complete ✅' AS status;
