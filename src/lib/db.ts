import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not set — database features will be unavailable.');
}

export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: false, // change to { rejectUnauthorized: false } for cloud Postgres
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  : null;

// Test connection on startup and ensure tables exist
export async function initDb() {
  if (!pool) return;
  try {
    const client = await pool.connect();
    try {
      console.log('✅ PostgreSQL connected to campusiq database');

      // 1. Create users table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'student',
          department TEXT,
          year TEXT,
          semester TEXT,
          roll_number TEXT,
          avatar_url TEXT,
          phone_number TEXT,
          subject TEXT,
          employee_id TEXT,
          section TEXT,
          email_verified BOOLEAN NOT NULL DEFAULT true,
          verification_token TEXT,
          verification_token_expires TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // 2. Create documents table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          department TEXT NOT NULL DEFAULT 'General Academic',
          category TEXT NOT NULL DEFAULT 'Circular',
          academic_year TEXT NOT NULL DEFAULT '2026-2027',
          published_date TEXT,
          file_type TEXT NOT NULL DEFAULT 'pdf',
          file_size TEXT NOT NULL DEFAULT '1.0 MB',
          status TEXT NOT NULL DEFAULT 'indexed',
          total_chunks INTEGER NOT NULL DEFAULT 4,
          summary TEXT,
          content_raw TEXT,
          section TEXT,
          uploaded_by_id TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // 3. Create notices table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS notices (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'Circular',
          urgency TEXT NOT NULL DEFAULT 'normal',
          publish_date TEXT NOT NULL,
          department TEXT NOT NULL DEFAULT 'General Academic',
          action_required_date TEXT,
          ai_summary TEXT,
          full_content TEXT,
          source_doc_id TEXT,
          image_url TEXT,
          file_url TEXT,
          tags TEXT[],
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // 4. Ensure columns in case tables were created with older schema
      await client.query(`
        ALTER TABLE documents ADD COLUMN IF NOT EXISTS section TEXT;
        ALTER TABLE documents ADD COLUMN IF NOT EXISTS uploaded_by_id TEXT;
        ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_raw TEXT;
        ALTER TABLE documents ADD COLUMN IF NOT EXISTS image_url TEXT;
        ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_url TEXT;
        ALTER TABLE documents ADD COLUMN IF NOT EXISTS action_required_date TEXT;
        ALTER TABLE notices ADD COLUMN IF NOT EXISTS image_url TEXT;
        ALTER TABLE notices ADD COLUMN IF NOT EXISTS file_url TEXT;
        ALTER TABLE notices ADD COLUMN IF NOT EXISTS action_required_date TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS section TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT true;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMPTZ;
      `);

      // 4. Create password_reset_otps if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS password_reset_otps (
          id SERIAL PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          otp_code VARCHAR(6) NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          used BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // 4b. Create calendar_events table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS calendar_events (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          category TEXT NOT NULL DEFAULT 'Academic',
          event_date TEXT NOT NULL,
          end_date TEXT,
          date_str TEXT,
          department TEXT NOT NULL DEFAULT 'College',
          description TEXT,
          source_doc_id TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // 5. Seed AITHON 2.0 in documents & notices if missing, and clean timetable from notices
      await client.query(`
        INSERT INTO documents (id, title, department, category, academic_year, published_date, file_type, file_size, status, total_chunks, summary, content_raw, action_required_date)
        VALUES (
          'doc_aithon2',
          'AITHON 2.0 – National Level Hackathon',
          'General Academic',
          'Events',
          '2026-2027',
          'Sep 29, 2026',
          'pdf',
          '1.2 MB',
          'indexed',
          2,
          'National Level Hackathon AITHON 2.0. Prize Pool: ₹1,00,000/-. Registration Deadline: 4 October 2026.',
          '📢 AITHON 2.0 – National Level Hackathon\n\nAll UG students are encouraged to participate in AITHON 2.0, organized by Amrutvahini College of Engineering, Sangamner.\n\n🏆 Prize Pool: ₹1,00,000/-\n👥 Team Size: 4–6 students\n🎓 Eligibility: All UG students\n💰 Registration Fee: ₹50/- per team\n📅 Registration Deadline: 4 October 2026\n🌐 Registration: aithon2-0.xyz',
          'Oct 04, 2026'
        ) ON CONFLICT (id) DO UPDATE SET
          action_required_date = 'Oct 04, 2026',
          summary = 'National Level Hackathon AITHON 2.0. Prize Pool: ₹1,00,000/-. Registration Deadline: 4 October 2026.';

        INSERT INTO notices (id, title, category, urgency, publish_date, department, action_required_date, ai_summary, full_content, source_doc_id, tags)
        VALUES (
          'not_aithon2',
          '📢 AITHON 2.0 – National Level Hackathon',
          'Events',
          'urgent',
          'Just Now',
          'General Academic',
          'Oct 04, 2026',
          'All UG students are encouraged to participate in AITHON 2.0. Prize Pool: ₹1,00,000/-. Registration Deadline: 4 October 2026.',
          '📢 AITHON 2.0 – National Level Hackathon\n\nAll UG students are encouraged to participate in AITHON 2.0, organized by Amrutvahini College of Engineering, Sangamner.\n\n🏆 Prize Pool: ₹1,00,000/-\n👥 Team Size: 4–6 students\n🎓 Eligibility: All UG students\n💰 Registration Fee: ₹50/- per team\n📅 Registration Deadline: 4 October 2026\n🌐 Registration: aithon2-0.xyz',
          'doc_aithon2',
          ARRAY['Hackathon', 'AITHON', 'Events', 'National']
        ) ON CONFLICT (id) DO UPDATE SET
          action_required_date = 'Oct 04, 2026',
          urgency = 'urgent',
          title = '📢 AITHON 2.0 – National Level Hackathon';

        -- Remove timetable notices so notices page only shows real circulars/events
        DELETE FROM notices WHERE category = 'Timetable' OR LOWER(title) LIKE '%timetable%' OR LOWER(title) LIKE '% cse b tt%';

        -- Remove any deleted WhatsApp Image documents/notices
        DELETE FROM notices WHERE LOWER(title) LIKE '%whatsapp image%' OR LOWER(title) LIKE '%whatsapp%';
        DELETE FROM documents WHERE LOWER(title) LIKE '%whatsapp image%' OR LOWER(title) LIKE '%whatsapp%';

        -- Ensure TCS Codevita has its deadline and correct urgency (normal = plenty of time)
        UPDATE documents SET action_required_date = 'Nov 13, 2026' WHERE LOWER(title) LIKE '%tcs%codevita%' AND (action_required_date IS NULL OR action_required_date = '');
        UPDATE notices SET action_required_date = 'Nov 13, 2026', urgency = 'normal' WHERE LOWER(title) LIKE '%tcs%codevita%' AND (action_required_date IS NULL OR action_required_date = '');

        -- Clean chunk jargon from existing summaries
        UPDATE documents SET summary = REGEXP_REPLACE(summary, 'Indexed with [0-9]+ semantic chunks\.?', '', 'g') WHERE summary LIKE '%Indexed with%';
        UPDATE notices SET ai_summary = REGEXP_REPLACE(ai_summary, 'Indexed with [0-9]+ semantic chunks\.?', '', 'g') WHERE ai_summary LIKE '%Indexed with%';
      `);

      console.log('✅ PostgreSQL schema verified and ready');
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('❌ PostgreSQL connection / init error:', err.message);
    console.error('   Check DATABASE_URL in your .env file or ensure PostgreSQL server is running.');
  }
}

if (pool) {
  initDb();
}

