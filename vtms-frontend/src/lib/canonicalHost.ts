/** Apex host must not stay active — Vercel 308s API POSTs to www and breaks login. */
const APEX = 'scmtvet.com';
const CANONICAL = 'www.scmtvet.com';

export function redirectToCanonicalHost(): boolean {
  if (typeof window === 'undefined') return false;
  const { hostname, pathname, search, hash, protocol } = window.location;
  if (hostname !== APEX) return false;
  window.location.replace(`${protocol}//${CANONICAL}${pathname}${search}${hash}`);
  return true;
}
