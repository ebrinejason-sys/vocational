import { getAccessToken } from './session';

export type DeleteEntityType =
  | 'trainee'
  | 'batch'
  | 'inventory_item'
  | 'financial_transaction'
  | 'trainee_interview'
  | 'trainee_document';

export async function submitDeleteRequest(payload: {
  entityType: DeleteEntityType;
  entityId: string;
  entityLabel: string;
  reason: string;
}): Promise<{ requestId: string }> {
  const res = await fetch('/api/request-delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string; requestId?: string };
  if (!res.ok || !json.requestId) {
    throw new Error(json.error ?? 'Could not submit delete request');
  }
  return { requestId: json.requestId };
}

export async function reviewDeleteRequest(payload: {
  requestId: string;
  decision: 'approve' | 'reject';
  reviewNote?: string;
}): Promise<void> {
  const res = await fetch('/api/review-delete-request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(json.error ?? 'Could not review delete request');
  }
}

/** Strong confirm for admin hard deletes. Returns false if cancelled. */
export function confirmAdminDelete(label: string): boolean {
  return window.confirm(
    `PERMANENT DELETE\n\n` +
      `You are about to permanently delete:\n“${label}”\n\n` +
      `This cannot be undone. Continue only if you are sure.`,
  );
}

/** Prompt non-admins for a reason; null if cancelled. */
export function promptDeleteReason(label: string): string | null {
  const reason = window.prompt(
    `You cannot delete directly. Request admin permission to delete:\n“${label}”\n\n` +
      `Enter a reason (required):`,
  );
  if (reason === null) return null;
  if (!reason.trim() || reason.trim().length < 5) {
    window.alert('Please enter a reason with at least 5 characters.');
    return null;
  }
  return reason.trim();
}
