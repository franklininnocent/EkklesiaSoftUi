/**
 * Subscription admin layout version switch.
 *
 * - **1** — Original layout: full Settings header + L1 subscription tabs + plan editor header/tabs (stacked).
 * - **2** — Compact layout: hides L1 chrome on plan editor; unified breadcrumb + plan tabs in one band.
 *
 * Revert by setting this constant back to `1`.
 */
export type SubscriptionAdminLayoutVersion = 1 | 2;

export const SUBSCRIPTION_ADMIN_LAYOUT_VERSION: SubscriptionAdminLayoutVersion = 2;

export function isSubscriptionAdminLayoutV2(): boolean {
  return SUBSCRIPTION_ADMIN_LAYOUT_VERSION === 2;
}

export function isPlanEditorRoute(url: string): boolean {
  return /\/settings\/subscription\/plans\/\d+/.test(url.split('?')[0]);
}
