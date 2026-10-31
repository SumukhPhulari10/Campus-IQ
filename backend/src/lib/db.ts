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
        ALTER TABLE documents ADD COLUMN IF NOT EXISTS target_bucket TEXT DEFAULT 'dashboard';
        ALTER TABLE notices ADD COLUMN IF NOT EXISTS image_url TEXT;
        ALTER TABLE notices ADD COLUMN IF NOT EXISTS file_url TEXT;
        ALTER TABLE notices ADD COLUMN IF NOT EXISTS action_required_date TEXT;
        ALTER TABLE notices ADD COLUMN IF NOT EXISTS target_bucket TEXT DEFAULT 'dashboard';
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

      // 4b. Create student reviews table if not exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS student_reviews (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT,
          name TEXT NOT NULL,
          department TEXT NOT NULL DEFAULT 'General Academic',
          year TEXT,
          semester TEXT,
          section TEXT,
          rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
          review_text TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // 4c. Create calendar_events table if not exists
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

      // 4c. Create chat_messages table to store conversation history between user and AI bot
      await client.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT,
          user_email TEXT,
          session_id TEXT DEFAULT 'default',
          sender VARCHAR(20) NOT NULL,
          message TEXT NOT NULL,
          source_doc TEXT,
          citations JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id, created_at ASC);
        CREATE INDEX IF NOT EXISTS idx_chat_messages_email ON chat_messages(user_email, created_at ASC);
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

        -- Remove any deleted WhatsApp Image documents/notices
        DELETE FROM notices WHERE LOWER(title) LIKE '%whatsapp image%' OR LOWER(title) LIKE '%whatsapp%';
        DELETE FROM documents WHERE LOWER(title) LIKE '%whatsapp image%' OR LOWER(title) LIKE '%whatsapp%';

        -- Ensure TCS Codevita has its deadline and correct urgency (normal = plenty of time)
        UPDATE documents SET action_required_date = 'Nov 13, 2026' WHERE LOWER(title) LIKE '%tcs%codevita%' AND (action_required_date IS NULL OR action_required_date = '');
        UPDATE notices SET action_required_date = 'Nov 13, 2026', urgency = 'normal' WHERE LOWER(title) LIKE '%tcs%codevita%' AND (action_required_date IS NULL OR action_required_date = '');

        -- Clean up unwanted 19th October deadline
        UPDATE documents SET action_required_date = NULL WHERE action_required_date LIKE '%19%' AND action_required_date LIKE '%Oct%';
        UPDATE notices SET action_required_date = NULL WHERE action_required_date LIKE '%19%' AND action_required_date LIKE '%Oct%';
        DELETE FROM calendar_events WHERE (date_str LIKE '%19%' AND date_str LIKE '%Oct%') OR (event_date LIKE '%19%' AND event_date LIKE '%Oct%');

        -- Clean chunk jargon from existing summaries
        UPDATE documents SET summary = REGEXP_REPLACE(summary, 'Indexed with [0-9]+ semantic chunks\.?', '', 'g') WHERE summary LIKE '%Indexed with%';
        UPDATE notices SET ai_summary = REGEXP_REPLACE(ai_summary, 'Indexed with [0-9]+ semantic chunks\.?', '', 'g') WHERE ai_summary LIKE '%Indexed with%';
      `);

      // 6. Automatically generate and backfill PDF URLs for any non-image documents in the database missing file_url
      try {
        const { generatePdfDataUrl } = await import('./pdfGenerator.js');
        const missingDocs = await client.query(`
          SELECT id, title, department, category, academic_year, published_date, content_raw, action_required_date, file_type
          FROM documents
          WHERE (file_url IS NULL OR file_url = '') AND file_type != 'image'
        `);

        for (const row of missingDocs.rows) {
          const generatedPdf = await generatePdfDataUrl({
            title: row.title,
            department: row.department,
            category: row.category,
            academicYear: row.academic_year,
            publishedDate: row.published_date,
            actionRequiredDate: row.action_required_date,
            contentRaw: row.content_raw || row.title,
          });
          await client.query('UPDATE documents SET file_url = $1 WHERE id = $2', [generatedPdf, row.id]);
          await client.query('UPDATE notices SET file_url = $1 WHERE source_doc_id = $2 OR id = $3', [generatedPdf, row.id, `not_${row.id}`]);
          console.log(`[DB Init] Generated and saved PDF URL in DB for document "${row.title}" (${row.id})`);
        }

        // Ensure notices always inherit file_url from documents
        await client.query(`
          UPDATE notices n
          SET file_url = d.file_url,
              image_url = COALESCE(n.image_url, d.image_url)
          FROM documents d
          WHERE (n.source_doc_id = d.id OR n.id = 'not_' || d.id)
            AND (n.file_url IS NULL OR n.file_url = '')
            AND d.file_url IS NOT NULL;
        `);
      } catch (genErr: any) {
        console.warn('[DB Init] PDF URL generation notice:', genErr.message);
      }

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

