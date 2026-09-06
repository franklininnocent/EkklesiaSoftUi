import {
  CertificateThemeId,
  ChurchDenominationCode,
  DenominationType,
} from '../models/certificate';

const EASTERN_CODES = new Set([
  'SYRO_MALABAR',
  'SYRO_MALANKARA',
  'ORTHODOX',
  'ORIENTAL_ORTHODOX',
  'COPTIC',
  'ARMENIAN',
  'MAR_THOMA',
]);

/**
 * Maps canonical church_profiles denomination codes onto engine DenominationType.
 */
export function mapChurchDenominationCode(
  code: ChurchDenominationCode | null | undefined
): DenominationType {
  const key = (code || '').toString().trim().toUpperCase();
  if (!key) {
    return 'GENERIC';
  }
  if (key === 'CATHOLIC' || key === 'ROMAN_CATHOLIC') {
    return 'ROMAN_CATHOLIC';
  }
  if (EASTERN_CODES.has(key)) {
    return 'EASTERN_RITE';
  }
  if (key === 'CSI' || key === 'CHURCH_OF_SOUTH_INDIA') {
    return 'CSI';
  }
  if (key === 'ANGLICAN' || key === 'EPISCOPAL') {
    return 'ANGLICAN';
  }
  if (key === 'LUTHERAN') {
    return 'LUTHERAN';
  }
  if (key === 'NON_DENOM' || key === 'NON_DENOMINATIONAL') {
    return 'NON_DENOM';
  }
  return 'GENERIC';
}

/**
 * Visual theme for a denomination. Anglican aliases CSI; Lutheran / non-denom alias generic.
 */
export function themeIdForDenomination(type: DenominationType): CertificateThemeId {
  switch (type) {
    case 'ROMAN_CATHOLIC':
    case 'EASTERN_RITE':
      return 'catholic';
    case 'CSI':
    case 'ANGLICAN':
      return 'csi';
    default:
      return 'generic';
  }
}
