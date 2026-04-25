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
-- Function: auto-create profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
`;

async function run() {
  await client.connect();
  await client.query(sql);
  console.log('✓ Profile auto-create trigger installed');
  await client.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
