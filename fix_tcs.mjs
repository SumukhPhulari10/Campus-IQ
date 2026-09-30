import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://postgres:campusiq123@localhost:5433/campusiq' });

async function fix() {
  await pool.query(
    "UPDATE documents SET action_required_date = $1 WHERE id = $2",
    ['Nov 13, 2026', 'doc_1790702595058']
  );
  await pool.query(
    "UPDATE notices SET action_required_date = $1, urgency = $2 WHERE id = $3",
    ['Nov 13, 2026', 'normal', 'not_doc_1790702595058']
  );
  console.log('✅ TCS Codevita deadline set to Nov 13, 2026 | urgency = normal');
  await pool.end();
}

fix().catch(e => { console.error(e.message); pool.end(); });
