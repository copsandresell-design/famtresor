const https = require('https');

const SUPABASE_URL = 'https://zqflavaescqohivvvnnmw.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_SECRET_KEY) {
  console.error('❌ SUPABASE_SECRET_KEY manquante!');
  process.exit(1);
}

const sql = `
CREATE TABLE IF NOT EXISTS profile_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  photo_url TEXT NOT NULL,
  uploaded_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

ALTER TABLE profile_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Anyone can view profile photos"
ON profile_photos FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Users can upload their own photo"
ON profile_photos FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Users can update their own photo"
ON profile_photos FOR UPDATE USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_profile_photos_user_id ON profile_photos(user_id);
`;

async function createTable() {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + '/rest/v1/rpc/exec_sql');
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SECRET_KEY
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`${res.statusCode}: ${data}`));
        } else {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify({ sql }));
    req.end();
  });
}

createTable()
  .then(() => console.log('✅ Table profile_photos créée!'))
  .catch(e => {
    console.error('❌ Erreur:', e.message);
    process.exit(1);
  });
