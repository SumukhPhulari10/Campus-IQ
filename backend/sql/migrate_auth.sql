-- ─────────────────────────────────────────────────────────────
-- CampusIQ Auth Migration: Email Verification + OTP Reset
-- Run once against your PostgreSQL database (CampusIQ Docker)
-- ─────────────────────────────────────────────────────────────

-- 1. Add email verification columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified              BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS verification_token          TEXT,
  ADD COLUMN IF NOT EXISTS verification_token_expires  TIMESTAMPTZ;

-- 2. Create OTP table (UUID user_id matches users.id UUID type)
CREATE TABLE IF NOT EXISTS password_reset_otps (
  id          SERIAL      PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  otp_code    VARCHAR(6)  NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Index for fast OTP lookup
CREATE INDEX IF NOT EXISTS idx_otp_user_id ON password_reset_otps(user_id);

-- 4. Mark existing users as already verified
UPDATE users SET email_verified = true WHERE email_verified = false;

SELECT 'Migration complete ✅' AS status;
