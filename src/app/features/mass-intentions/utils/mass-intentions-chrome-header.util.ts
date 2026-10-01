import { isMassIntentionsChromeV2 } from '../config/mass-intentions-chrome.version';

/** Home dashboard subtitle under the page title. */
export function massIntentionsHomePeriodSubtitle(periodLabel: string | undefined): string {
  const sep = isMassIntentionsChromeV2() ? '·' : '—';
  return periodLabel
    ? `Parish office register ${sep} ${periodLabel}`
    : `Parish office register ${sep} open intentions and monthly activity.`;
}

/** Back link to dashboard from Reports / Audit (V1 only). */
export function massIntentionsDashboardBackLink(): string[] | undefined {
  return isMassIntentionsChromeV2() ? undefined : ['/mass-intentions'];
}

/** Back link on Settings (V1 only; label was "Dashboard", path was intentions). */
export function massIntentionsSettingsBackLink(): string[] | undefined {
  return isMassIntentionsChromeV2() ? undefined : ['/mass-intentions/intentions'];
}

export function massIntentionsSettingsBackLabel(): string {
  return 'Dashboard';
}

export function massIntentionsReportsBackLabel(): string {
  return 'Dashboard';
}

export function massIntentionsAuditBackLabel(): string {
  return 'Dashboard';
}
