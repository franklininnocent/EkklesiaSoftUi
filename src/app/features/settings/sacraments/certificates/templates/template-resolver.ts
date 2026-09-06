import {
  CertificateTemplateVersion,
  CertificateThemeId,
  PaperSize,
  SacramentEngineType,
  SignatureSlot,
} from '../models/certificate';
import { CANONICAL_SACRAMENTAL_EMBLEM } from '../emblems/canonical-emblem';

export interface TemplateResolveInput {
  themeId: CertificateThemeId;
  sacramentType: SacramentEngineType;
  version?: string;
  paper?: PaperSize;
}

function slots(...labels: string[]): SignatureSlot[] {
  return labels.map((label, index) => ({
    id: `sig_${index}`,
    label,
  }));
}

function template(
  themeId: CertificateThemeId,
  sacramentType: SacramentEngineType,
  fieldOrder: string[],
  signatureLabels: string[],
  microprintText: string,
  version = '1.0.0'
): CertificateTemplateVersion {
  return {
    id: `${themeId}_${sacramentType.toLowerCase()}_v1`,
    version,
    status: 'PUBLISHED',
    themeId,
    sacramentType,
    emblem: CANONICAL_SACRAMENTAL_EMBLEM,
    paperDefault: 'A4',
    signatureSlots: slots(...signatureLabels),
    fieldOrder,
    showRegistry: true,
    showSeal: true,
    microprintText,
  };
}

const BAPTISM_FIELDS = [
  'recipient',
  'date',
  'place',
  'birth',
  'parents',
  'sponsors',
  'minister',
];
const CONFIRMATION_FIELDS = ['recipient', 'date', 'place', 'sponsors', 'minister'];
const COMMUNION_FIELDS = ['recipient', 'date', 'place', 'minister'];
const MATRIMONY_FIELDS = ['spouses', 'date', 'place', 'parents', 'witnesses', 'minister'];
const GENERIC_FIELDS = ['recipient', 'date', 'place', 'minister'];

const CATALOG: CertificateTemplateVersion[] = [
  template('catholic', 'BAPTISM', BAPTISM_FIELDS, ['Parish Priest', 'Parish Registrar'], 'IN NOMINE PATRIS'),
  template('catholic', 'CONFIRMATION', CONFIRMATION_FIELDS, ['Bishop / Minister', 'Parish Registrar'], 'SPIRITUS SANCTUS'),
  template('catholic', 'CHRISMATION', CONFIRMATION_FIELDS, ['Celebrant', 'Parish Registrar'], 'SPIRITUS SANCTUS'),
  template('catholic', 'FIRST_HOLY_COMMUNION', COMMUNION_FIELDS, ['Parish Priest', 'Parish Registrar'], 'CORPUS CHRISTI'),
  template('catholic', 'HOLY_MATRIMONY', MATRIMONY_FIELDS, ['Celebrant', 'Parish Registrar'], 'QUOD DEUS CONIUNXIT', '1.1.0'),
  template('catholic', 'ANOINTING_OF_THE_SICK', GENERIC_FIELDS, ['Parish Priest', 'Parish Registrar'], 'SACRAMENTUM'),
  template('catholic', 'HOLY_ORDERS', GENERIC_FIELDS, ['Ordaining Bishop', 'Parish Registrar'], 'IN NOMINE PATRIS'),
  template('catholic', 'RECONCILIATION', GENERIC_FIELDS, ['Parish Priest', 'Parish Registrar'], 'SACRAMENTUM'),
  template('catholic', 'GENERIC_REGISTRY', GENERIC_FIELDS, ['Parish Priest', 'Parish Registrar'], 'SACRAMENTUM'),

  template('csi', 'BAPTISM', BAPTISM_FIELDS, ['Presbyter', 'Church Secretary'], 'CHURCH OF SOUTH INDIA'),
  template('csi', 'CONFIRMATION', CONFIRMATION_FIELDS, ['Bishop / Presbyter', 'Church Secretary'], 'CHURCH OF SOUTH INDIA'),
  template('csi', 'CHRISMATION', CONFIRMATION_FIELDS, ['Presbyter', 'Church Secretary'], 'CHURCH OF SOUTH INDIA'),
  template('csi', 'FIRST_HOLY_COMMUNION', COMMUNION_FIELDS, ['Presbyter', 'Church Secretary'], 'CHURCH OF SOUTH INDIA'),
  template('csi', 'HOLY_MATRIMONY', MATRIMONY_FIELDS, ['Presbyter', 'Church Secretary'], 'CHURCH OF SOUTH INDIA', '1.1.0'),
  template('csi', 'ANOINTING_OF_THE_SICK', GENERIC_FIELDS, ['Presbyter', 'Church Secretary'], 'CHURCH OF SOUTH INDIA'),
  template('csi', 'HOLY_ORDERS', GENERIC_FIELDS, ['Bishop / Presbyter', 'Church Secretary'], 'CHURCH OF SOUTH INDIA'),
  template('csi', 'RECONCILIATION', GENERIC_FIELDS, ['Presbyter', 'Church Secretary'], 'CHURCH OF SOUTH INDIA'),
  template('csi', 'GENERIC_REGISTRY', GENERIC_FIELDS, ['Presbyter', 'Church Secretary'], 'CHURCH OF SOUTH INDIA'),

  template('generic', 'BAPTISM', BAPTISM_FIELDS, ['Minister', 'Registrar'], 'CHURCH REGISTER'),
  template('generic', 'CONFIRMATION', CONFIRMATION_FIELDS, ['Minister', 'Registrar'], 'CHURCH REGISTER'),
  template('generic', 'CHRISMATION', CONFIRMATION_FIELDS, ['Minister', 'Registrar'], 'CHURCH REGISTER'),
  template('generic', 'FIRST_HOLY_COMMUNION', COMMUNION_FIELDS, ['Minister', 'Registrar'], 'CHURCH REGISTER'),
  template('generic', 'HOLY_MATRIMONY', MATRIMONY_FIELDS, ['Minister', 'Registrar'], 'CHURCH REGISTER', '1.1.0'),
  template('generic', 'ANOINTING_OF_THE_SICK', GENERIC_FIELDS, ['Minister', 'Registrar'], 'CHURCH REGISTER'),
  template('generic', 'HOLY_ORDERS', GENERIC_FIELDS, ['Minister', 'Registrar'], 'CHURCH REGISTER'),
  template('generic', 'RECONCILIATION', GENERIC_FIELDS, ['Minister', 'Registrar'], 'CHURCH REGISTER'),
  template('generic', 'GENERIC_REGISTRY', GENERIC_FIELDS, ['Minister', 'Registrar'], 'CHURCH REGISTER'),
];

export function resolveTemplate(input: TemplateResolveInput): CertificateTemplateVersion {
  const version = input.version || (input.sacramentType === 'HOLY_MATRIMONY' ? '1.1.0' : '1.0.0');
  const found =
    CATALOG.find(
      (row) =>
        row.themeId === input.themeId &&
        row.sacramentType === input.sacramentType &&
        row.version === version
    ) ||
    CATALOG.find(
      (row) => row.themeId === input.themeId && row.sacramentType === input.sacramentType
    ) ||
    CATALOG.find((row) => row.themeId === 'generic' && row.sacramentType === input.sacramentType) ||
    CATALOG.find((row) => row.themeId === 'generic' && row.sacramentType === 'GENERIC_REGISTRY');

  const resolved =
    found ??
    (CATALOG.find((row) => row.themeId === 'generic' && row.sacramentType === 'GENERIC_REGISTRY') as CertificateTemplateVersion);
  if (input.paper) {
    return { ...resolved, paperDefault: input.paper };
  }
  return resolved;
}

export function publishedTemplates(): CertificateTemplateVersion[] {
  return CATALOG.filter((row) => row.status === 'PUBLISHED');
}
