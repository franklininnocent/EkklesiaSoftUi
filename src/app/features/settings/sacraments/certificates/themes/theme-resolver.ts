import { CertificateThemeId, CertificateThemeTokens, DenominationType } from '../models/certificate';
import { themeIdForDenomination } from '../denomination/denomination.mapper';
import { CATHOLIC_THEME } from './catholic.theme';
import { CSI_THEME } from './csi.theme';
import { GENERIC_THEME } from './generic.theme';

const THEMES: Record<CertificateThemeId, CertificateThemeTokens> = {
  catholic: CATHOLIC_THEME,
  csi: CSI_THEME,
  generic: GENERIC_THEME,
};

export function resolveTheme(themeId: CertificateThemeId): CertificateThemeTokens {
  return THEMES[themeId] ?? GENERIC_THEME;
}

export function resolveThemeForDenomination(type: DenominationType): CertificateThemeTokens {
  return resolveTheme(themeIdForDenomination(type));
}

export function themeTokensToCssVars(tokens: CertificateThemeTokens): Record<string, string> {
  return {
    '--cert-page-bg': tokens.pageBackground,
    '--cert-ink': tokens.ink,
    '--cert-muted': tokens.mutedInk,
    '--cert-accent': tokens.accent,
    '--cert-border-outer': tokens.borderOuter,
    '--cert-border-inner': tokens.borderInner,
    '--cert-microprint': tokens.microprintColor,
    '--cert-font-heading': tokens.headingFont,
    '--cert-font-body': tokens.bodyFont,
    '--cert-font-display': tokens.displayFont,
    '--cert-seal': tokens.sealStroke,
  };
}
