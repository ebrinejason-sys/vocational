import { getAccessToken } from './session';

export async function notifyProcurementAssignment(payload: {
  requestId?: string;
  assignedToId: string;
  itemName: string;
  quantityRequested: number;
  estimatedCost: number;
}): Promise<{ emailSent: boolean; emailWarning?: string }> {
  const res = await fetch('/api/notify-procurement-assignment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    emailSent?: boolean;
    emailWarning?: string;
  };
  if (!res.ok) {
    throw new Error(json.error ?? 'Failed to email assigned staff');
  }
  return {
    emailSent: Boolean(json.emailSent),
    emailWarning: json.emailWarning,
  };
}
