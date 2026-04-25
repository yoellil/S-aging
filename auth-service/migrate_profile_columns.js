/**
 * migrate_profile_columns.js
 *
 * Run once to add new profile columns and create the profile-pictures
 * storage bucket.  Safe to re-run (uses IF NOT EXISTS).
 *
 * Usage:  node migrate_profile_columns.js
 */
import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: 'db.vzalcimmoapdquezzbqe.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: '123darrylpogi123',
  ssl: { rejectUnauthorized: false },
});

const sql = `
-- ── Add new profile columns ─────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMPTZ DEFAULT NOW();

-- ── Index for faster username lookups ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- ── Ensure uniqueness constraint on username ─────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_username' AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT unique_username UNIQUE(username);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- constraint already exists, ignore
END $$;
`;

async function migrate() {
  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL');
    await client.query(sql);
    console.log('✓ Profile columns added: profile_picture_url, full_name, bio, phone, profile_updated_at');
    console.log('✓ Username index created');
    console.log('✓ Username uniqueness constraint ensured');
    console.log('');
    console.log('NOTE: You must also create the "profile-pictures" storage bucket');
    console.log('      via the Supabase Dashboard → Storage → New bucket.');
    console.log('      Set it to PUBLIC and add RLS policies as documented.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
