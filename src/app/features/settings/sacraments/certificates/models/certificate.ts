/**
 * Sacramental certificate domain types (discriminated unions).
 * Canonical DB sacrament codes stay BAPTISM / CONFIRMATION / EUCHARIST / MATRIMONY.
 * Spec names (FIRST_HOLY_COMMUNION, HOLY_MATRIMONY, CHRISMATION, ROMAN_CATHOLIC)
 * exist only at the engine boundary.
 */

export type ChurchDenominationCode =
  | 'CATHOLIC'
  | 'SYRO_MALABAR'
  | 'SYRO_MALANKARA'
  | 'ORTHODOX'
  | 'ORIENTAL_ORTHODOX'
  | 'COPTIC'
  | 'ARMENIAN'
  | 'MAR_THOMA'
  | 'CSI'
  | 'ANGLICAN'
  | 'LUTHERAN'
  | 'NON_DENOM'
  | string;

export type DenominationType =
  | 'ROMAN_CATHOLIC'
  | 'EASTERN_RITE'
  | 'CSI'
  | 'ANGLICAN'
  | 'LUTHERAN'
  | 'NON_DENOM'
  | 'GENERIC';

export type CertificateThemeId = 'catholic' | 'csi' | 'generic';

export type SacramentEngineType =
  | 'BAPTISM'
  | 'CONFIRMATION'
  | 'CHRISMATION'
  | 'FIRST_HOLY_COMMUNION'
  | 'HOLY_MATRIMONY'
  | 'ANOINTING_OF_THE_SICK'
  | 'HOLY_ORDERS'
  | 'RECONCILIATION'
  | 'GENERIC_REGISTRY';

export type PaperSize = 'A4' | 'LETTER';

export type EmblemId = 'CHI_RHO' | 'SACRED_HEART' | 'DOVE' | 'CROSS' | 'PALM' | 'NONE';

export type TextFitPolicy = 'WRAP_THEN_SCALE';

export type TextFitStatus = 'OK' | 'SCALED' | 'ERROR';

export type CertificateLocale = 'en';

export interface ChurchMetadata {
  name: string;
  diocese?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  logoHash?: string | null;
  sealUrl?: string | null;
  denominationCode: ChurchDenominationCode;
  denominationType: DenominationType;
  /** Derived from tenant slug/id until a real parish_code column exists. */
  parishCode?: string | null;
}

export interface RegistryIndex {
  bookNumber?: string | null;
  pageNumber?: string | null;
  registryEntry?: string | null;
  certificateNumber?: string | null;
}

export interface MatrimonySpouseSnapshot {
  fullName: string;
  baptismalStatusLabel?: string | null;
  ecclesialAffiliationLabel?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  parishResidence?: string | null;
}

export interface SignatureSlot {
  id: string;
  label: string;
  name?: string | null;
}

export interface CertificateBaseData {
  tenantId?: number | null;
  church: ChurchMetadata;
  sacramentType: SacramentEngineType;
  dateOfEvent: string;
  placeOfEvent?: string | null;
  registry: RegistryIndex;
  locale: CertificateLocale;
  paper: PaperSize;
  themeId: CertificateThemeId;
  emblem: EmblemId;
  certificateTitle: string;
  subtitle: string;
  issuedAt?: string | null;
  status?: 'draft_preview' | 'issued' | 'superseded' | 'voided';
  verificationUrl?: string | null;
  verificationQrDataUri?: string | null;
}

export interface BaptismCertificateData extends CertificateBaseData {
  sacramentType: 'BAPTISM';
  recipientName: string;
  dateOfBirth?: string | null;
  placeOfBirth?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  sponsors: string[];
  ministerName?: string | null;
  ministerTitle?: string | null;
}

export interface ConfirmationCertificateData extends CertificateBaseData {
  sacramentType: 'CONFIRMATION' | 'CHRISMATION';
  recipientName: string;
  baptismDate?: string | null;
  baptismPlace?: string | null;
  confirmationName?: string | null;
  sponsors: string[];
  ministerName?: string | null;
  ministerTitle?: string | null;
}

export interface FirstCommunionCertificateData extends CertificateBaseData {
  sacramentType: 'FIRST_HOLY_COMMUNION';
  recipientName: string;
  eventSubtype?: string | null;
  ministerName?: string | null;
  ministerTitle?: string | null;
}

export interface MatrimonyCertificateData extends CertificateBaseData {
  sacramentType: 'HOLY_MATRIMONY';
  brideName: string;
  groomName: string;
  bride?: MatrimonySpouseSnapshot;
  groom?: MatrimonySpouseSnapshot;
  brideParents?: { father?: string | null; mother?: string | null };
  groomParents?: { father?: string | null; mother?: string | null };
  brideDiocese?: string | null;
  groomDiocese?: string | null;
  witnesses: string[];
  ministerName?: string | null;
  ministerTitle?: string | null;
}

export interface AnointingCertificateData extends CertificateBaseData {
  sacramentType: 'ANOINTING_OF_THE_SICK';
  recipientName: string;
  placeClassification?: string | null;
  ministerName?: string | null;
  ministerTitle?: string | null;
}

export interface HolyOrdersCertificateData extends CertificateBaseData {
  sacramentType: 'HOLY_ORDERS';
  recipientName: string;
  ordinationType?: string | null;
  dioceseName?: string | null;
  coConsecrators: string[];
  ministerName?: string | null;
  ministerTitle?: string | null;
}

export interface ReconciliationCertificateData extends CertificateBaseData {
  sacramentType: 'RECONCILIATION';
  recipientName: string;
  ministerName?: string | null;
  ministerTitle?: string | null;
}

export interface GenericRegistryCertificateData extends CertificateBaseData {
  sacramentType: 'GENERIC_REGISTRY';
  recipientName: string;
  ministerName?: string | null;
  ministerTitle?: string | null;
  extraFields: Array<{ label: string; value: string }>;
}

export type SacramentCertificateData =
  | BaptismCertificateData
  | ConfirmationCertificateData
  | FirstCommunionCertificateData
  | MatrimonyCertificateData
  | AnointingCertificateData
  | HolyOrdersCertificateData
  | ReconciliationCertificateData
  | GenericRegistryCertificateData;

export interface LiturgicalTerminology {
  sacramentTitle: string;
  subtitle: string;
  recipientLabel: string;
  dateLabel: string;
  placeLabel: string;
  ministerLabel: string;
  registrarLabel: string;
  sponsorsLabel: string;
  fatherLabel: string;
  motherLabel: string;
  brideLabel: string;
  groomLabel: string;
  witnessesLabel: string;
  sealLabel: string;
  registryBookLabel: string;
  registryPageLabel: string;
  registryEntryLabel: string;
  certificateNumberLabel: string;
  issuedAtLabel: string;
  nameAsRecordedLabel: string;
  baptismalStatusLabel: string;
  parishResidenceLabel: string;
  witness1Label: string;
  witness2Label: string;
  dateOfBirthLabel: string;
  placeOfBirthLabel: string;
  verifyHint: string;
  issuedNotice: string;
}

export interface CertificateThemeTokens {
  id: CertificateThemeId;
  pageBackground: string;
  ink: string;
  mutedInk: string;
  accent: string;
  borderOuter: string;
  borderInner: string;
  microprintColor: string;
  headingFont: string;
  bodyFont: string;
  displayFont: string;
  sealStroke: string;
}

export interface PrintSpecification {
  paper: PaperSize;
  landscape: true;
  widthMm: number;
  heightMm: number;
  safeAreaMm: number;
}

export const PRINT_SPEC: Record<PaperSize, PrintSpecification> = {
  A4: {
    paper: 'A4',
    landscape: true,
    widthMm: 297,
    heightMm: 210,
    safeAreaMm: 16,
  },
  LETTER: {
    paper: 'LETTER',
    landscape: true,
    widthMm: 279.4,
    heightMm: 215.9,
    safeAreaMm: 16,
  },
};

/** Recipient display size (mm) — keep in sync with --cert-size-recipient / CertificateLayoutTokens.php */
export const CERT_RECIPIENT_FONT_MM = 10;

export interface CertificateTemplateVersion {
  id: string;
  version: string;
  status: 'PUBLISHED';
  themeId: CertificateThemeId;
  sacramentType: SacramentEngineType;
  emblem: EmblemId;
  paperDefault: PaperSize;
  signatureSlots: SignatureSlot[];
  fieldOrder: string[];
  showRegistry: boolean;
  showSeal: boolean;
  microprintText: string;
}

export interface CertificateLocaleConfig {
  locale: CertificateLocale;
  dateStyle: Intl.DateTimeFormatOptions;
}

export const EN_LOCALE: CertificateLocaleConfig = {
  locale: 'en',
  dateStyle: { day: 'numeric', month: 'long', year: 'numeric' },
};

export function formatCertificateDate(
  iso: string | null | undefined,
  locale: CertificateLocale = 'en'
): string {
  if (!iso) {
    return '';
  }
  const dateOnly = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return iso;
  }
  const date = new Date(`${dateOnly}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const config = locale === 'en' ? EN_LOCALE : EN_LOCALE;
  return new Intl.DateTimeFormat('en-GB', config.dateStyle).format(date);
}

export function isBaptismCertificate(
  data: SacramentCertificateData
): data is BaptismCertificateData {
  return data.sacramentType === 'BAPTISM';
}

export function isConfirmationCertificate(
  data: SacramentCertificateData
): data is ConfirmationCertificateData {
  return data.sacramentType === 'CONFIRMATION' || data.sacramentType === 'CHRISMATION';
}

export function isFirstCommunionCertificate(
  data: SacramentCertificateData
): data is FirstCommunionCertificateData {
  return data.sacramentType === 'FIRST_HOLY_COMMUNION';
}

export function isMatrimonyCertificate(
  data: SacramentCertificateData
): data is MatrimonyCertificateData {
  return data.sacramentType === 'HOLY_MATRIMONY';
}

export function isAnointingCertificate(
  data: SacramentCertificateData
): data is AnointingCertificateData {
  return data.sacramentType === 'ANOINTING_OF_THE_SICK';
}

export function isHolyOrdersCertificate(
  data: SacramentCertificateData
): data is HolyOrdersCertificateData {
  return data.sacramentType === 'HOLY_ORDERS';
}

export function isReconciliationCertificate(
  data: SacramentCertificateData
): data is ReconciliationCertificateData {
  return data.sacramentType === 'RECONCILIATION';
}
