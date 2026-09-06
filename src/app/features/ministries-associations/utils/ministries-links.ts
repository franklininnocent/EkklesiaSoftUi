/**
 * Build tenant-aware Ministries & Associations paths.
 * Works for both `/ministries/...` and `/tenant/:tenantId/ministries/...`.
 */
export function ministriesBasePath(currentUrl: string): string {
  const match = currentUrl.match(/^(\/tenant\/[^/?#]+\/ministries)(?:\/|$|\?|#)/);
  return match?.[1] ?? '/ministries';
}

export function ministriesLink(currentUrl: string, ...segments: string[]): string {
  const base = ministriesBasePath(currentUrl);
  const path = segments.filter(Boolean).join('/');
  return path ? `${base}/${path}` : base;
}
