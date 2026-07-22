/**
 * Bootstrap / update the invisible owner admin account.
 * Reads OWNER_BOOTSTRAP_* from repo-root .env.local (never commit secrets).
 *
 * Usage (from repo root, with Node installed):
 *   node scripts/bootstrap-owner-admin.mjs
 */
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnvLocal() {
  const raw = readFileSync(resolve(root, '.env.local'), 'utf8');
  const map = {};
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 1) continue;
    map[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return map;
}

const env = loadEnvLocal();
const url = env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const email = (env.OWNER_BOOTSTRAP_EMAIL || 'ebrinetushabe@gmail.com').toLowerCase();
const password = env.OWNER_BOOTSTRAP_PASSWORD;
const fullName = env.OWNER_BOOTSTRAP_NAME || 'System Owner';

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}
if (!password || password === 'FILL_ME') {
  console.error('Set OWNER_BOOTSTRAP_PASSWORD in .env.local first');
  process.exit(1);
}

const admin = createClient(url, serviceKey);
const passwordHash = await bcrypt.hash(password, 12);

const { data: existing } = await admin
  .from('profiles')
  .select('id')
  .eq('email', email)
  .maybeSingle();

if (existing?.id) {
  const { error } = await admin
    .from('profiles')
    .update({
      full_name: fullName,
      role: 'admin',
      active: true,
      password_hash: passwordHash,
      hidden_from_staff: true,
      failed_login_attempts: 0,
      locked_until: null,
      invite_token: null,
      invite_token_expires_at: null,
      password_reset_token: null,
      password_reset_expires_at: null,
    })
    .eq('id', existing.id);
  if (error) {
    console.error('Update failed:', error.message);
    process.exit(1);
  }
  console.log(`Updated owner admin ${email} (id=${existing.id}, hidden_from_staff=true)`);
} else {
  const id = randomUUID();
  const { error } = await admin.from('profiles').insert({
    id,
    email,
    full_name: fullName,
    role: 'admin',
    active: true,
    password_hash: passwordHash,
    hidden_from_staff: true,
  });
  if (error) {
    console.error('Insert failed:', error.message);
    process.exit(1);
  }
  console.log(`Created owner admin ${email} (id=${id}, hidden_from_staff=true)`);
}
