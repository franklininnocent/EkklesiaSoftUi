/**
 * The one place that maps screens to plan feature codes (codes come from the API feature catalog).
 * Used to hide links; routes enforce the same codes via `entitlementGuard` and the API via
 * `entitlement:CODE` middleware.
 */
export const ROUTE_FEATURE_REQUIREMENTS: Readonly<Record<string, string>> = {
  '/donations': 'CONTRIBUTIONS',
  '/donations/plans': 'CONTRIBUTION_PLANS',
  '/donations/history': 'AUDIT_LOG',
  '/ministries': 'MINISTRIES',
  '/mass-intentions': 'MASS_INTENTIONS',
  '/ministries/audit': 'AUDIT_LOG',
  '/settings/data-export': 'IMPORT_EXPORT',
};

/** Feature codes a route needs: its own entry plus any parent section entry. */
export function featuresForRoute(route: string | null | undefined): string[] {
  if (!route) return [];
  const path = route.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const codes: string[] = [];
  for (const [prefix, code] of Object.entries(ROUTE_FEATURE_REQUIREMENTS)) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      codes.push(code);
    }
  }
  return codes;
}
