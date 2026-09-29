/**
 * Parish product API path prefixes that receive X-Support-Session-Id when a
 * support session is active. Server validates the header via support_sessions.
 *
 * Platform APIs (/api/support/tickets, /api/admin/*, /api/users, /api/roles, …)
 * are intentionally excluded.
 */
export const PARISH_PRODUCT_API_PREFIXES: readonly string[] = [
  '/api/tenant/',
  '/api/church-profile',
  '/api/church-leadership',
  '/api/church-statistics',
  '/api/church-social-media',
  '/api/families',
  '/api/members',
  '/api/persons',
  '/api/sacraments',
  '/api/bcc',
  '/api/ministries',
  '/api/pastoral',
];

export function isParishProductApiPath(path: string): boolean {
  return PARISH_PRODUCT_API_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(prefix)
  );
}
