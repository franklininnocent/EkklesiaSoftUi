/**
 * Mass Intentions module chrome version.
 * Restore Version 1 → set `MASS_INTENTIONS_CHROME_VERSION` to `1`.
 * Version 2 (compact nav) is the default after redesign.
 */
export type MassIntentionsChromeVersion = 1 | 2;

/** Change to `1` to restore the original card-style workspace chrome. */
export const MASS_INTENTIONS_CHROME_VERSION: MassIntentionsChromeVersion = 2;

export function isMassIntentionsChromeV2(): boolean {
  return MASS_INTENTIONS_CHROME_VERSION === 2;
}
