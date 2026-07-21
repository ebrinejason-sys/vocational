import type { VercelRequest } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET!;

export interface StaffProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  active: boolean;
}

export function getAdminClient(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase server credentials');
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

export function requireJwtSecret(): string {
  if (!JWT_SECRET) {
    throw new Error('Missing SUPABASE_JWT_SECRET');
  }
  return JWT_SECRET;
}

export function signAccessToken(userId: string, email: string): string {
  const secret = requireJwtSecret();
  return jwt.sign(
    {
      sub: userId,
      email,
      role: 'authenticated',
      iss: 'supabase',
    },
    secret,
    { expiresIn: '7d', audience: 'authenticated' },
  );
}

export function verifyAccessToken(token: string): { sub: string; email?: string } | null {
  try {
    const payload = jwt.verify(token, requireJwtSecret(), {
      audience: 'authenticated',
    }) as jwt.JwtPayload;
    if (!payload.sub || typeof payload.sub !== 'string') return null;
    return { sub: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
  } catch {
    return null;
  }
}

export function bearerToken(req: VercelRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length);
}

export async function getCallerFromRequest(
  req: VercelRequest,
): Promise<{ id: string; profile: StaffProfile } | null> {
  const token = bearerToken(req);
  if (!token) return null;

  const payload = verifyAccessToken(token);
  if (!payload) return null;

  const admin = getAdminClient();
  const { data: profile, error } = await admin
    .from('profiles')
    .select('id, full_name, email, role, active')
    .eq('id', payload.sub)
    .single();

  if (error || !profile || !profile.active) return null;
  return { id: profile.id, profile };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function newToken(): string {
  return randomBytes(32).toString('hex');
}

export function tokenExpiry(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}
