// Creates the core SCM staff accounts (one per role) in Supabase Auth and
// inserts their matching profiles rows.
//
// PREREQUISITE: run docs/migrations/2026-07-13-roles-and-data-cleanup.sql
// first (Step 1 then Step 2) so the new enum roles exist.
//
// Usage (from the repo root):
//   node scripts/create-core-users.mjs
//
// Credentials are written to scripts/core-users.credentials.txt (git-ignored,
// local only). Share each password with its staff member privately and have
// them change it after first sign-in. Delete the file once distributed.

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import { randomBytes } from 'crypto';

const envText = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  })
);

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Plus-addressed emails all deliver to the base inbox; swap for each staff
// member's real address when you know it (Admin → Staff page can also
// invite by email once the redirect fix is deployed).
const BASE = 'ebrinejason';
const CORE_USERS = [
  { role: 'director', fullName: 'Director', email: `${BASE}+director@gmail.com` },
  { role: 'project_coordinator', fullName: 'Project Coordinator', email: `${BASE}+coordinator@gmail.com` },
  { role: 'trainer', fullName: 'Trainer', email: `${BASE}+trainer@gmail.com` },
  { role: 'finance_officer', fullName: 'Finance', email: `${BASE}+finance@gmail.com` },
  { role: 'logistics_officer', fullName: 'Logistics & Procurement', email: `${BASE}+logistics@gmail.com` },
  { role: 'case_worker', fullName: 'Case Worker', email: `${BASE}+caseworker@gmail.com` },
];

function generatePassword() {
  // 16 chars, URL-safe, no ambiguous characters
  return randomBytes(12).toString('base64url').replace(/[-_]/g, 'x');
}

const lines = ['SCM VTMS — core staff accounts (change passwords after first sign-in!)', ''];
let failures = 0;

for (const u of CORE_USERS) {
  const password = generatePassword();
  const { data, error } = await admin.auth.admin.createUser({
    email: u.email,
    password,
    email_confirm: true,
  });
  if (error) {
    console.error(`✗ ${u.role} (${u.email}): ${error.message}`);
    failures++;
    continue;
  }
  const { error: profileError } = await admin.from('profiles').insert({
    id: data.user.id,
    full_name: u.fullName,
    email: u.email,
    role: u.role,
    active: true,
  });
  if (profileError) {
    console.error(`✗ profile for ${u.role}: ${profileError.message} — cleaning up auth user`);
    await admin.auth.admin.deleteUser(data.user.id).catch(() => {});
    failures++;
    continue;
  }
  lines.push(`${u.fullName} <${u.email}>  role=${u.role}  password=${password}`);
  console.log(`✓ created ${u.role} (${u.email})`);
}

writeFileSync(new URL('./core-users.credentials.txt', import.meta.url), lines.join('\n') + '\n');
console.log(`\nDone (${CORE_USERS.length - failures}/${CORE_USERS.length} created).`);
console.log('Passwords written to scripts/core-users.credentials.txt — distribute privately, then delete the file.');
