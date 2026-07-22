import type { SupabaseClient } from '@supabase/supabase-js';

export async function logActivity(
  admin: SupabaseClient,
  opts: {
    actorId?: string | null;
    actorEmail?: string | null;
    actorName?: string | null;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    summary: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await admin.from('activity_log').insert({
      actor_id: opts.actorId ?? null,
      actor_email: opts.actorEmail ?? null,
      actor_name: opts.actorName ?? null,
      action: opts.action,
      entity_type: opts.entityType ?? null,
      entity_id: opts.entityId ?? null,
      summary: opts.summary,
      metadata: opts.metadata ?? {},
    });
  } catch (err) {
    console.error('activity_log insert failed', err);
  }
}

export function generateOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
