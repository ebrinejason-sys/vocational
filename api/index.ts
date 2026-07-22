import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Single Hobby-plan-friendly entrypoint for all API routes.
 * vercel.json rewrites /api/* → /api?__path=*
 */
import authLogin from './_lib/handlers/auth-login';
import authVerifyOtp from './_lib/handlers/auth-verify-otp';
import authSetPassword from './_lib/handlers/auth-set-password';
import authForgotPassword from './_lib/handlers/auth-forgot-password';
import inviteStaff from './_lib/handlers/invite-staff';
import updateStaff from './_lib/handlers/update-staff';
import deleteStaff from './_lib/handlers/delete-staff';
import resetStaffPassword from './_lib/handlers/reset-staff-password';
import notifyFinancialChange from './_lib/handlers/notify-financial-change';
import notifyProcurementAssignment from './_lib/handlers/notify-procurement-assignment';
import requestDelete from './_lib/handlers/request-delete';
import reviewDeleteRequest from './_lib/handlers/review-delete-request';
import receiptsCreate from './_lib/handlers/receipts-create';

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>;

const ROUTES: Record<string, ApiHandler> = {
  'auth/login': authLogin,
  'auth/verify-otp': authVerifyOtp,
  'auth/set-password': authSetPassword,
  'auth/forgot-password': authForgotPassword,
  'invite-staff': inviteStaff,
  'update-staff': updateStaff,
  'delete-staff': deleteStaff,
  'reset-staff-password': resetStaffPassword,
  'notify-financial-change': notifyFinancialChange,
  'notify-procurement-assignment': notifyProcurementAssignment,
  'request-delete': requestDelete,
  'review-delete-request': reviewDeleteRequest,
  'receipts/create': receiptsCreate,
};

function resolvePath(req: VercelRequest): string {
  const q = req.query.__path;
  if (typeof q === 'string' && q.trim()) {
    return q.replace(/^\/+|\/+$/g, '');
  }
  if (Array.isArray(q) && q[0]) {
    return String(q[0]).replace(/^\/+|\/+$/g, '');
  }

  // Fallback if rewrite preserved original URL
  const raw = req.url ?? '';
  const pathname = raw.split('?')[0] ?? '';
  return pathname.replace(/^\/?api\/?/, '').replace(/^\/+|\/+$/g, '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = resolvePath(req);
  const route = ROUTES[path];
  if (!route) {
    res.status(404).json({ error: `Unknown API route: ${path || '(empty)'}` });
    return;
  }
  return route(req, res);
}
