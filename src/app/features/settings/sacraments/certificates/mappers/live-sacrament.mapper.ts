import { Sacrament, SacramentParticipant } from '../../models/sacrament.model';
import {
  ChurchMetadata,
  PaperSize,
  SacramentCertificateData,
} from '../models/certificate';
import { mapChurchDenominationCode, themeIdForDenomination } from '../denomination/denomination.mapper';
import { mapDbSacramentToEngineType } from '../denomination/capabilities';
import { liturgicalTerminology } from '../terminology/en.catalog';
import { CANONICAL_SACRAMENTAL_EMBLEM } from '../emblems/canonical-emblem';
import { resolveTemplate } from '../templates/template-resolver';
import { mapProjectionToCertificateData } from './certificate-view.mapper';

function participantName(row: SacramentParticipant): string {
  return String(row.snapshot_json?.full_name || row.external_full_name || '').trim();
}

export function mapLiveSacramentToCertificateData(
  sacrament: Sacrament,
  church: ChurchMetadata,
  paper: PaperSize = 'A4'
): SacramentCertificateData {
  const denominationType = church.denominationType || mapChurchDenominationCode(church.denominationCode);
  const engineType = mapDbSacramentToEngineType(sacrament.sacrament_type?.code || '', denominationType);
  const terms = liturgicalTerminology(denominationType, engineType);
  const themeId = themeIdForDenomination(denominationType);
  const template = resolveTemplate({ themeId, sacramentType: engineType, paper });
  const participants = Array.isArray(sacrament.participants) ? sacrament.participants : [];
  const byRole = (role: string): string[] =>
    participants
      .filter((row) => String(row.role || '').toLowerCase() === role)
      .map(participantName)
      .filter(Boolean);

  const projection = {
    sacrament: {
      type_code: sacrament.sacrament_type?.code,
      date_administered: sacrament.date_administered,
      place_administered: sacrament.place_administered,
      recipient_name: sacrament.recipient_name,
      minister_name: sacrament.minister_name,
      minister_title: sacrament.minister_title,
      father_name: sacrament.father_name,
      mother_name: sacrament.mother_name,
      godparent1_name: sacrament.godparent1_name,
      godparent2_name: sacrament.godparent2_name,
      marriage_bride_full_name: sacrament.marriage_bride_full_name,
      marriage_groom_full_name: sacrament.marriage_groom_full_name,
      marriage_bride_father_name: sacrament.marriage_bride_father_name,
      marriage_bride_mother_name: sacrament.marriage_bride_mother_name,
      marriage_bride_address: sacrament.marriage_bride_address,
      marriage_bride_church_name: sacrament.marriage_bride_church_name,
      marriage_bride_church_address: sacrament.marriage_bride_church_address,
      marriage_groom_father_name: sacrament.marriage_groom_father_name,
      marriage_groom_mother_name: sacrament.marriage_groom_mother_name,
      marriage_groom_address: sacrament.marriage_groom_address,
      marriage_groom_church_name: sacrament.marriage_groom_church_name,
      marriage_groom_church_address: sacrament.marriage_groom_church_address,
      marriage_bride_diocese_name: sacrament.marriage_bride_diocese_name,
      marriage_groom_diocese_name: sacrament.marriage_groom_diocese_name,
      certificate_number: sacrament.certificate_number,
      book_number: sacrament.book_number,
      page_number: sacrament.page_number,
      registry_entry: sacrament.registry_entry,
      event_subtype: sacrament.event_subtype,
      recipient_birth_date: sacrament.recipient_birth_date,
      recipient_birth_place: sacrament.recipient_birth_place,
    },
    participants: participants.map((p) => ({
      role: p.role,
      display_name: participantName(p),
      snapshot: p.snapshot_json || {},
      affiliation_parish_name: p.affiliation_parish_name,
      affiliation_diocese_name: p.affiliation_diocese_name,
    })),
    church: {
      name: church.name,
      diocese: church.diocese,
      address: church.address,
      logo_url: church.logoUrl,
      seal_url: church.sealUrl,
      denomination_code: church.denominationCode,
      denomination_type: denominationType,
      parish_code: church.parishCode,
    },
  };

  const mapped = mapProjectionToCertificateData(projection, { paper, churchFallback: church });
  if (mapped) {
    mapped.certificateTitle = terms.sacramentTitle;
    mapped.subtitle = terms.subtitle;
    mapped.emblem = CANONICAL_SACRAMENTAL_EMBLEM;
    mapped.themeId = themeId;
    if (mapped.sacramentType === 'BAPTISM' && !mapped.sponsors.length) {
      mapped.sponsors = byRole('godfather').concat(byRole('godmother'));
    }
    return mapped;
  }

  return {
    church: { ...church, denominationType },
    sacramentType: 'GENERIC_REGISTRY',
    dateOfEvent: String(sacrament.date_administered || ''),
    placeOfEvent: sacrament.place_administered || null,
    registry: {
      bookNumber: sacrament.book_number,
      pageNumber: sacrament.page_number,
      registryEntry: sacrament.registry_entry,
      certificateNumber: sacrament.certificate_number,
    },
    locale: 'en',
    paper,
    themeId,
    emblem: CANONICAL_SACRAMENTAL_EMBLEM,
    certificateTitle: terms.sacramentTitle,
    subtitle: terms.subtitle,
    recipientName: sacrament.recipient_name || '',
    extraFields: [],
  };
}
