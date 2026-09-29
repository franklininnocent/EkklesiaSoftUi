import {
  AnointingCertificateData,
  BaptismCertificateData,
  ChurchMetadata,
  ConfirmationCertificateData,
  FirstCommunionCertificateData,
  GenericRegistryCertificateData,
  HolyOrdersCertificateData,
  MatrimonyCertificateData,
  PaperSize,
  ReconciliationCertificateData,
  SacramentCertificateData,
} from '../models/certificate';
import { mapChurchDenominationCode, themeIdForDenomination } from '../denomination/denomination.mapper';
import { mapDbSacramentToEngineType } from '../denomination/capabilities';
import { liturgicalTerminology } from '../terminology/en.catalog';
import { CANONICAL_SACRAMENTAL_EMBLEM } from '../emblems/canonical-emblem';
import { resolveTemplate } from '../templates/template-resolver';

type Dict = Record<string, unknown>;

function asDict(value: unknown): Dict {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Dict) : {};
}

function str(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text === '' ? null : text;
}

function namesByRole(participants: unknown, role: string): string[] {
  if (!Array.isArray(participants)) {
    return [];
  }
  return participants
    .filter((row) => String(asDict(row)['role'] || '').toLowerCase() === role.toLowerCase())
    .map((row) => str(asDict(row)['display_name']))
    .filter((name): name is string => !!name);
}

function firstName(participants: unknown, roles: string[], fallback?: string | null): string {
  for (const role of roles) {
    const found = namesByRole(participants, role)[0];
    if (found) {
      return found;
    }
  }
  return str(fallback) || '';
}

function spouseFrom(
  participants: unknown,
  role: string,
  sacrament: Dict,
  prefix: string,
  fallbackName: string
): import('../models/certificate').MatrimonySpouseSnapshot {
  const rows = Array.isArray(participants) ? participants : [];
  const row = rows.find((item) => String(asDict(item)['role'] || '').toLowerCase() === role);
  const dict = asDict(row);
  const snapshot = asDict(dict['snapshot'] || dict['snapshot_json']);
  const affiliation = asDict(snapshot['affiliation']);
  const fullName =
    str(snapshot['full_name']) || str(dict['display_name']) || str(sacrament[`${prefix}full_name`]) || fallbackName;
  const parish =
    str(affiliation['parish_name']) ||
    str(dict['affiliation_parish_name']) ||
    str(sacrament[`${prefix}church_name`]);
  const address =
    str(snapshot['address']) ||
    str(sacrament[`${prefix}address`]) ||
    str(sacrament[`${prefix}church_address`]);
  const residence = [parish, address].filter(Boolean).join(', ');
  const statusParts = [str(snapshot['baptismal_status_label']), str(snapshot['ecclesial_affiliation_label'])].filter(
    Boolean
  );
  return {
    fullName,
    baptismalStatusLabel: statusParts.length ? statusParts.join(' · ') : null,
    ecclesialAffiliationLabel: str(snapshot['ecclesial_affiliation_label']),
    fatherName: str(snapshot['father_name']) || str(sacrament[`${prefix}father_name`]),
    motherName: str(snapshot['mother_name']) || str(sacrament[`${prefix}mother_name`]),
    parishResidence: residence || null,
  };
}

function churchFromProjection(projection: Dict, fallback?: Partial<ChurchMetadata>): ChurchMetadata {
  const church = asDict(projection['church']);
  const denominationCode = str(church['denomination_code']) || fallback?.denominationCode || 'GENERIC';
  const denominationType =
    (church['denomination_type'] as ChurchMetadata['denominationType']) ||
    mapChurchDenominationCode(denominationCode);
  return {
    name: str(church['name']) || fallback?.name || 'Parish Church',
    diocese: str(church['diocese']) || fallback?.diocese || null,
    address: str(church['address']) || fallback?.address || null,
    logoUrl: null,
    logoHash: null,
    sealUrl: str(church['seal_url']) || fallback?.sealUrl || null,
    denominationCode,
    denominationType,
    parishCode: str(church['parish_code']) || fallback?.parishCode || null,
  };
}

/**
 * Maps frozen projection_json (v1 or v2) onto SacramentCertificateData.
 * Prefers certificate_view when present so issued snapshots never re-derive from live records.
 */
export function mapProjectionToCertificateData(
  projection: Record<string, unknown> | null | undefined,
  options?: {
    paper?: PaperSize;
    churchFallback?: Partial<ChurchMetadata>;
    status?: SacramentCertificateData['status'];
  }
): SacramentCertificateData | null {
  if (!projection) {
    return null;
  }

  const view = asDict(projection['certificate_view']);
  if (view['sacramentType'] || view['sacrament_type']) {
    return normalizeCertificateView(view, options?.paper);
  }

  const sacrament = asDict(projection['sacrament']);
  const participants = projection['participants'];
  const church = churchFromProjection(projection, options?.churchFallback);
  const dbCode = str(sacrament['type_code']) || '';
  const engineType = mapDbSacramentToEngineType(dbCode, church.denominationType);
  const terms = liturgicalTerminology(church.denominationType, engineType);
  const themeId = themeIdForDenomination(church.denominationType);
  const paper = options?.paper || 'A4';
  const template = resolveTemplate({ themeId, sacramentType: engineType, paper });
  const render = asDict(projection['render']);

  const base = {
    church,
    dateOfEvent: str(sacrament['date_administered']) || '',
    placeOfEvent: str(sacrament['place_administered']),
    registry: {
      bookNumber: str(sacrament['book_number']),
      pageNumber: str(sacrament['page_number']),
      registryEntry: str(sacrament['registry_entry']),
      certificateNumber: str(sacrament['certificate_number']),
    },
    locale: 'en' as const,
    paper,
    themeId: (str(render['theme_id']) as typeof themeId) || themeId,
    emblem: CANONICAL_SACRAMENTAL_EMBLEM,
    certificateTitle: terms.sacramentTitle,
    subtitle: terms.subtitle,
    status: options?.status,
    verificationUrl: str(asDict(projection['verification'])['url']),
    verificationQrDataUri: str(asDict(projection['verification'])['qr_data_uri']),
    issuedAt: str(projection['issued_at']),
  };

  if (engineType === 'BAPTISM') {
    const data: BaptismCertificateData = {
      ...base,
      sacramentType: 'BAPTISM',
      recipientName: firstName(participants, ['recipient'], str(sacrament['recipient_name'])),
      dateOfBirth: str(sacrament['recipient_birth_date']) || str(asDict(sacrament['typed_attributes'])['recipient_birth_date']),
      placeOfBirth: str(sacrament['recipient_birth_place']) || str(asDict(sacrament['typed_attributes'])['recipient_birth_place']),
      fatherName: firstName(participants, ['father'], str(sacrament['father_name'])) || null,
      motherName: firstName(participants, ['mother'], str(sacrament['mother_name'])) || null,
      sponsors: [
        ...namesByRole(participants, 'godfather'),
        ...namesByRole(participants, 'godmother'),
        ...namesByRole(participants, 'godparent'),
        ...namesByRole(participants, 'sponsor'),
      ].filter(Boolean),
      ministerName: firstName(participants, ['minister'], str(sacrament['minister_name'])) || null,
      ministerTitle: str(sacrament['minister_title']),
    };
    if (!data.sponsors.length) {
      const g1 = str(sacrament['godparent1_name']);
      const g2 = str(sacrament['godparent2_name']);
      data.sponsors = [g1, g2].filter((name): name is string => !!name);
    }
    return data;
  }

  if (engineType === 'CONFIRMATION' || engineType === 'CHRISMATION') {
    const data: ConfirmationCertificateData = {
      ...base,
      sacramentType: engineType,
      recipientName: firstName(participants, ['recipient', 'candidate'], str(sacrament['recipient_name'])),
      sponsors: namesByRole(participants, 'sponsor'),
      ministerName: firstName(participants, ['minister'], str(sacrament['minister_name'])) || null,
      ministerTitle: str(sacrament['minister_title']),
    };
    return data;
  }

  if (engineType === 'FIRST_HOLY_COMMUNION') {
    const data: FirstCommunionCertificateData = {
      ...base,
      sacramentType: 'FIRST_HOLY_COMMUNION',
      recipientName: firstName(participants, ['recipient'], str(sacrament['recipient_name'])),
      eventSubtype: str(sacrament['event_subtype']),
      ministerName: firstName(participants, ['minister'], str(sacrament['minister_name'])) || null,
      ministerTitle: str(sacrament['minister_title']),
    };
    return data;
  }

  if (engineType === 'HOLY_MATRIMONY') {
    const brideName = firstName(participants, ['bride'], str(sacrament['marriage_bride_full_name']));
    const groomName = firstName(participants, ['groom'], str(sacrament['marriage_groom_full_name']));
    const data: MatrimonyCertificateData = {
      ...base,
      sacramentType: 'HOLY_MATRIMONY',
      brideName,
      groomName,
      bride: spouseFrom(participants, 'bride', sacrament, 'marriage_bride_', brideName),
      groom: spouseFrom(participants, 'groom', sacrament, 'marriage_groom_', groomName),
      brideParents: {
        father: str(sacrament['marriage_bride_father_name']),
        mother: str(sacrament['marriage_bride_mother_name']),
      },
      groomParents: {
        father: str(sacrament['marriage_groom_father_name']),
        mother: str(sacrament['marriage_groom_mother_name']),
      },
      brideDiocese: str(sacrament['marriage_bride_diocese_name']),
      groomDiocese: str(sacrament['marriage_groom_diocese_name']),
      witnesses: namesByRole(participants, 'witness'),
      ministerName: firstName(participants, ['minister'], str(sacrament['minister_name'])) || null,
      ministerTitle: str(sacrament['minister_title']),
    };
    return data;
  }

  if (engineType === 'ANOINTING_OF_THE_SICK') {
    const data: AnointingCertificateData = {
      ...base,
      sacramentType: 'ANOINTING_OF_THE_SICK',
      recipientName: firstName(participants, ['recipient'], str(sacrament['recipient_name'])),
      placeClassification: str(sacrament['place_classification']),
      ministerName: firstName(participants, ['minister'], str(sacrament['minister_name'])) || null,
      ministerTitle: str(sacrament['minister_title']),
    };
    return data;
  }

  if (engineType === 'HOLY_ORDERS') {
    const typed = asDict(sacrament['typed_attributes']);
    const data: HolyOrdersCertificateData = {
      ...base,
      sacramentType: 'HOLY_ORDERS',
      recipientName: firstName(participants, ['candidate', 'recipient'], str(sacrament['recipient_name'])),
      ordinationType: str(typed['ordination_type']),
      dioceseName: str(typed['diocese_name']),
      coConsecrators: namesByRole(participants, 'co_consecrator'),
      ministerName: firstName(participants, ['minister'], str(sacrament['minister_name'])) || null,
      ministerTitle: str(sacrament['minister_title']),
    };
    return data;
  }

  if (engineType === 'RECONCILIATION') {
    const data: ReconciliationCertificateData = {
      ...base,
      sacramentType: 'RECONCILIATION',
      recipientName: firstName(participants, ['recipient'], str(sacrament['recipient_name'])),
      ministerName: firstName(participants, ['minister'], str(sacrament['minister_name'])) || null,
      ministerTitle: str(sacrament['minister_title']),
    };
    return data;
  }

  const extra: GenericRegistryCertificateData = {
    ...base,
    sacramentType: 'GENERIC_REGISTRY',
    recipientName: firstName(participants, ['recipient', 'candidate'], str(sacrament['recipient_name'])),
    ministerName: firstName(participants, ['minister'], str(sacrament['minister_name'])) || null,
    ministerTitle: str(sacrament['minister_title']),
    extraFields: [],
  };
  return extra;
}

function normalizeCertificateView(view: Dict, paper?: PaperSize): SacramentCertificateData {
  const sacramentType = String(view['sacramentType'] || view['sacrament_type']);
  const church = asDict(view['church']);
  const churchRest = { ...church };
  delete churchRest['logoDataUri'];
  const cloned = {
    ...view,
    sacramentType,
    paper: paper || view['paper'] || 'A4',
    emblem: CANONICAL_SACRAMENTAL_EMBLEM,
    church: {
      ...churchRest,
      logoUrl: null,
    },
    sponsors: Array.isArray(view['sponsors']) ? view['sponsors'] : [],
    witnesses: Array.isArray(view['witnesses']) ? view['witnesses'] : [],
    extraFields: Array.isArray(view['extraFields']) ? view['extraFields'] : [],
    coConsecrators: Array.isArray(view['coConsecrators']) ? view['coConsecrators'] : [],
  } as unknown as SacramentCertificateData;
  return cloned;
}

export function omitEmptyOptionalFields(data: SacramentCertificateData): SacramentCertificateData {
  const next = { ...data };
  const church = { ...next.church };
  if (!church.diocese) {
    delete church.diocese;
  }
  if (!church.address) {
    delete church.address;
  }
  if (!church.logoUrl) {
    delete church.logoUrl;
  }
  if (!church.sealUrl) {
    delete church.sealUrl;
  }
  if (!church.parishCode) {
    delete church.parishCode;
  }
  next.church = church;
  return next;
}
