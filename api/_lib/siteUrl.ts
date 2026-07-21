import type { VercelRequest } from '@vercel/node';

export function siteUrlFromRequest(req: VercelRequest): string {
  const forwardedHost = req.headers['x-forwarded-host'] ?? req.headers.host;
  return process.env.PUBLIC_SITE_URL ?? `https://${forwardedHost}`;
}
