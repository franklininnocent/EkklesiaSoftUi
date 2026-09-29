import { Injectable } from '@angular/core';
import {
  Sacrament,
  SacramentType,
  SacramentCreateRequest,
  SacramentParticipant,
  SacramentParticipantPayload,
} from '../models/sacrament.model';
import { DEFAULT_SACRAMENT_FORM, SacramentStatus, DATE_VALIDATION } from '../constants/sacrament.constants';
import { SacramentParticipantDraft } from '../models/sacrament-definition.model';
import { ChurchAffiliationValue } from '../components/shared/church-affiliation-control/church-affiliation-control.component';

export interface SacramentFormData {
  [key: string]: string | number | undefined | null;
}

export interface BaptismAffiliationInput {
  affiliation_type?: 'home_parish' | 'other' | null;
  affiliation_parish_name?: string;
  affiliation_parish_address?: string;
  affiliation_diocese_name?: string;
  affiliation_diocese_region?: string;
  affiliation_diocese_country?: string;
}

export interface BaptismParticipantsInput {
  recipient: SacramentParticipantDraft | null;
  affiliation: BaptismAffiliationInput | null;
  minister: SacramentParticipantDraft | null;
  formData: SacramentFormData;
  selectedFatherId: string | null;
  selectedMotherId: string | null;
}

export interface MarriageParticipantsInput {
  bride: SacramentParticipantDraft | null;
  groom: SacramentParticipantDraft | null;
  brideAffiliation: BaptismAffiliationInput | null;
  groomAffiliation: BaptismAffiliationInput | null;
  witnesses: SacramentParticipantDraft[];
  minister: SacramentParticipantDraft | null;
  formData: SacramentFormData;
}

@Injectable({
  providedIn: 'root'
})
export class SacramentFormService {
  /**
   * Initialize form data with default values
   */
  initializeFormData(): SacramentFormData {
    return { ...DEFAULT_SACRAMENT_FORM };
  }

  /**
   * Populate form data from sacrament entity
   */
  populateFormFromSacrament(sacrament: Sacrament): SacramentFormData {
    const formData = this.initializeFormData();
    
    // Basic Information
    formData['sacrament_type_id'] = sacrament.sacrament_type_id;
    formData['recipient_name'] = sacrament.recipient_name || '';
    formData['date_administered'] = sacrament.date_administered || '';
    formData['place_administered'] = sacrament.place_administered || '';
    formData['status'] = sacrament.status || SacramentStatus.REGISTERED;

    // Minister Information
    formData['minister_name'] = sacrament.minister_name || '';
    formData['minister_title'] = sacrament.minister_title || '';

    // Certificate Information
    formData['certificate_number'] = sacrament.certificate_number || '';
    formData['registry_entry'] = sacrament.registry_entry || '';
    formData['conditional_reason'] = sacrament.conditional_reason || '';
    formData['book_number'] = sacrament.book_number || '';
    formData['page_number'] = sacrament.page_number || '';

    // Recipient Information
    formData['recipient_birth_date'] = this.formatDateForInput(sacrament.recipient_birth_date);
    formData['recipient_birth_place'] = sacrament.recipient_birth_place || '';
    formData['recipient_gender'] = sacrament.recipient_gender;
    formData['baptism_date'] = this.formatDateForInput(sacrament.baptism_date);

    // Parents Information
    formData['father_name'] = sacrament.father_name || '';
    formData['mother_name'] = sacrament.mother_name || '';

    // Godparents
    formData['godparent1_name'] = sacrament.godparent1_name || '';
    formData['godparent2_name'] = sacrament.godparent2_name || '';

    // Marriage Information
    formData['marriage_bride_full_name'] = sacrament.marriage_bride_full_name || '';
    formData['marriage_bride_father_name'] = sacrament.marriage_bride_father_name || '';
    formData['marriage_bride_mother_name'] = sacrament.marriage_bride_mother_name || '';
    formData['marriage_bride_address'] = sacrament.marriage_bride_address || '';
    formData['marriage_bride_church_type'] = sacrament.marriage_bride_church_type || 'home_parish';
    formData['marriage_bride_church_name'] = sacrament.marriage_bride_church_name || '';
    formData['marriage_bride_church_address'] = sacrament.marriage_bride_church_address || '';
    
    formData['marriage_groom_full_name'] = sacrament.marriage_groom_full_name || '';
    formData['marriage_groom_father_name'] = sacrament.marriage_groom_father_name || '';
    formData['marriage_groom_mother_name'] = sacrament.marriage_groom_mother_name || '';
    formData['marriage_groom_address'] = sacrament.marriage_groom_address || '';
    formData['marriage_groom_church_type'] = sacrament.marriage_groom_church_type || 'home_parish';
    formData['marriage_groom_church_name'] = sacrament.marriage_groom_church_name || '';
    formData['marriage_groom_church_address'] = sacrament.marriage_groom_church_address || '';

    // Additional Information
    formData['witnesses'] = sacrament.witnesses || '';
    formData['notes'] = sacrament.notes || '';

    return formData;
  }

  /**
   * Restore marriage party drafts from stored participants (edit / correct).
   * Witnesses are always external and sacrament-local.
   */
  hydrateMarriageDrafts(sacrament: Sacrament, formData: SacramentFormData): {
    bride: SacramentParticipantDraft | null;
    groom: SacramentParticipantDraft | null;
    witnesses: SacramentParticipantDraft[];
    minister: SacramentParticipantDraft | null;
    brideAffiliation: ChurchAffiliationValue;
    groomAffiliation: ChurchAffiliationValue;
  } {
    const rows = [...(sacrament.participants || [])].sort(
      (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
    );
    const byRole = (role: string) => rows.filter((row) => row.role === role);

    const brideRow = byRole('bride')[0] || null;
    const groomRow = byRole('groom')[0] || null;
    const ministerRow = byRole('minister')[0] || null;

    return {
      bride: this.partyDraftFromRow(
        'bride',
        brideRow,
        String(formData['marriage_bride_full_name'] || '')
      ),
      groom: this.partyDraftFromRow(
        'groom',
        groomRow,
        String(formData['marriage_groom_full_name'] || '')
      ),
      witnesses: byRole('witness').map((row, index) => this.witnessDraftFromRow(row, index)),
      minister: this.ministerDraftFromRow(ministerRow, formData),
      brideAffiliation: this.affiliationFromRow(brideRow, formData, 'bride'),
      groomAffiliation: this.affiliationFromRow(groomRow, formData, 'groom'),
    };
  }

  private partyDraftFromRow(
    role: 'bride' | 'groom',
    row: SacramentParticipant | null,
    fallbackName: string
  ): SacramentParticipantDraft | null {
    if (row?.source === 'member' && row.family_member_id) {
      const name = row.snapshot_json?.full_name || row.external_full_name || fallbackName;
      return {
        role,
        source: 'member',
        family_member_id: row.family_member_id,
        display_name: name || undefined,
        external_date_of_birth: this.snapshotString(row, 'date_of_birth') || row.external_date_of_birth || undefined,
        external_gender: this.asGender(row.external_gender || row.snapshot_json?.gender),
        ...this.canonicalDraftFromRow(row),
      };
    }

    const name = (row?.external_full_name || row?.snapshot_json?.full_name || fallbackName || '').trim();
    if (!name) {
      return null;
    }

    return {
      role,
      source: 'external',
      external_full_name: name,
      display_name: name,
      external_date_of_birth: this.snapshotString(row, 'date_of_birth') || row?.external_date_of_birth || undefined,
      external_gender: this.asGender(row?.external_gender || row?.snapshot_json?.gender),
      ...this.canonicalDraftFromRow(row),
    };
  }

  private canonicalDraftFromRow(row: SacramentParticipant | null): Partial<SacramentParticipantDraft> {
    if (!row) {
      return {};
    }
    const snap = row.snapshot_json || {};
    return {
      father_name: snap.father_name || undefined,
      mother_name: snap.mother_name || undefined,
      baptismal_status: row.baptismal_status || snap.baptismal_status || undefined,
      ecclesial_affiliation_code: row.ecclesial_affiliation_code || snap.ecclesial_affiliation_code || undefined,
      ecclesial_affiliation_label: row.ecclesial_affiliation_label || snap.ecclesial_affiliation_label || undefined,
      canonical_delegation_status: row.canonical_delegation_status || snap.canonical_delegation_status || undefined,
    };
  }

  private witnessDraftFromRow(
    row: SacramentParticipant,
    index: number
  ): SacramentParticipantDraft {
    const name = (row.external_full_name || row.snapshot_json?.full_name || '').trim();
    return {
      role: 'witness',
      source: 'external',
      sort_order: index,
      external_full_name: name,
      display_name: name,
      external_gender: this.asGender(row.external_gender || row.snapshot_json?.gender),
      external_address: row.external_address || this.snapshotString(row, 'address') || undefined,
      external_contact_number: row.external_contact_number
        || this.snapshotString(row, 'contact_number')
        || undefined,
    };
  }

  private ministerDraftFromRow(
    row: SacramentParticipant | null,
    formData: SacramentFormData
  ): SacramentParticipantDraft | null {
    if (row?.source === 'internal_leadership' && (row.leadership_assignment_id || row.church_leadership_id)) {
      return {
        role: 'minister',
        source: 'internal_leadership',
        leadership_assignment_id: row.leadership_assignment_id ?? null,
        church_leadership_id: row.church_leadership_id ?? null,
        display_name: row.snapshot_json?.full_name || String(formData['minister_name'] || ''),
        ...this.canonicalDraftFromRow(row),
      };
    }

    const name = (row?.external_full_name
      || row?.snapshot_json?.full_name
      || String(formData['minister_name'] || '')).trim();
    if (!name) {
      return null;
    }

    return {
      role: 'minister',
      source: 'external',
      external_full_name: name,
      display_name: name,
      external_title: String(formData['minister_title'] || '') || undefined,
      ...this.canonicalDraftFromRow(row),
    };
  }

  private affiliationFromRow(
    row: SacramentParticipant | null,
    formData: SacramentFormData,
    party: 'bride' | 'groom'
  ): ChurchAffiliationValue {
    const prefix = party === 'bride' ? 'marriage_bride' : 'marriage_groom';
    const rawType = row?.affiliation_type || formData[`${prefix}_church_type`];
    const affiliationType: 'home_parish' | 'other' = rawType === 'other' ? 'other' : 'home_parish';

    return {
      affiliation_type: affiliationType,
      affiliation_parish_name: row?.affiliation_parish_name
        || String(formData[`${prefix}_church_name`] || '')
        || undefined,
      affiliation_diocese_name: row?.affiliation_diocese_name || undefined,
    };
  }

  private snapshotString(
    row: SacramentParticipant | null | undefined,
    key: string
  ): string {
    const value = row?.snapshot_json?.[key];
    return typeof value === 'string' ? value : '';
  }

  private asGender(value: string | null | undefined): SacramentParticipantDraft['external_gender'] {
    if (value === 'male' || value === 'female' || value === 'other') {
      return value;
    }
    return undefined;
  }

  /**
   * Check if sacrament type is Marriage
   */
  isMarriage(sacramentType: SacramentType | number | undefined, sacramentTypes: SacramentType[]): boolean {
    if (!sacramentType) return false;
    
    let type: SacramentType | undefined;
    
    if (typeof sacramentType === 'number') {
      type = sacramentTypes.find(t => t.id === sacramentType);
    } else {
      type = sacramentType;
    }
    
    if (!type) return false;
    
    const code = (type.code || '').toString().toUpperCase().trim();
    const name = (type.name || '').toString().toUpperCase().trim();
    const marriageCodes = ['MARRIAGE', 'MATRIMONY', 'WEDDING'];
    
    return marriageCodes.includes(code) || marriageCodes.some(mc => name.includes(mc));
  }

  /**
   * Check if sacrament type is Baptism
   */
  isBaptism(sacramentType: SacramentType | number | undefined, sacramentTypes: SacramentType[]): boolean {
    if (!sacramentType) return false;
    
    let type: SacramentType | undefined;
    
    if (typeof sacramentType === 'number') {
      type = sacramentTypes.find(t => t.id === sacramentType);
    } else {
      type = sacramentType;
    }
    
    if (!type) return false;
    
    const code = (type.code || '').toString().toUpperCase().trim();
    const name = (type.name || '').toString().toUpperCase().trim();
    const baptismCodes = ['BAPTISM', 'BAPTISMO', 'BAPTIMAL', 'BAPTISE'];
    
    return baptismCodes.includes(code) || baptismCodes.some(bc => name.includes(bc));
  }

  /**
   * Build request payload from form data
   */
  buildRequestPayload(formData: SacramentFormData, tenantId: number, familyId?: string | null, bccId?: string | null): SacramentCreateRequest {
    // Helper function to safely convert to string or undefined
    const toStringOrUndefined = (value: string | number | undefined | null): string | undefined => {
      if (value === null || value === undefined) return undefined;
      const str = String(value).trim();
      return str === '' ? undefined : str;
    };

    // Helper function to safely convert to SacramentStatus
    const toSacramentStatus = (value: string | number | undefined | null): SacramentStatus => {
      if (value === null || value === undefined) return SacramentStatus.REGISTERED;
      const str = String(value).toLowerCase();
      if (str === 'active' || str === 'registered') return SacramentStatus.REGISTERED;
      if (str === 'cancelled' || str === 'voided') return SacramentStatus.VOIDED;
      if (str === 'conditional') return SacramentStatus.CONDITIONAL;
      return SacramentStatus.REGISTERED;
    };

    // Helper function to safely convert to gender union type
    const toGender = (value: string | number | undefined | null): 'male' | 'female' | 'other' | undefined => {
      if (value === null || value === undefined) return undefined;
      const str = String(value).toLowerCase();
      if (str === 'male') return 'male';
      if (str === 'female') return 'female';
      if (str === 'other') return 'other';
      return undefined;
    };

    const payload: SacramentCreateRequest = {
      tenant_id: tenantId,
      sacrament_type_id: formData['sacrament_type_id'] as number,
      recipient_name: String(formData['recipient_name'] || ''),
      date_administered: String(formData['date_administered'] || ''),
      place_administered: toStringOrUndefined(formData['place_administered']),
      place_classification: toStringOrUndefined(formData['place_classification']),
      event_subtype: toStringOrUndefined(formData['event_subtype']),
      minister_name: toStringOrUndefined(formData['minister_name']),
      minister_title: toStringOrUndefined(formData['minister_title']),
      certificate_number: toStringOrUndefined(formData['certificate_number']),
      book_number: toStringOrUndefined(formData['book_number']),
      page_number: toStringOrUndefined(formData['page_number']),
      registry_entry: toStringOrUndefined(formData['registry_entry']),
      recipient_birth_date: toStringOrUndefined(formData['recipient_birth_date']),
      recipient_birth_place: toStringOrUndefined(formData['recipient_birth_place']),
      recipient_gender: toGender(formData['recipient_gender']),
      baptism_date: toStringOrUndefined(formData['baptism_date']),
      father_name: toStringOrUndefined(formData['father_name']),
      mother_name: toStringOrUndefined(formData['mother_name']),
      godparent1_name: toStringOrUndefined(formData['godparent1_name']),
      godparent2_name: toStringOrUndefined(formData['godparent2_name']),
      witnesses: toStringOrUndefined(formData['witnesses']),
      notes: toStringOrUndefined(formData['notes']),
      status: toSacramentStatus(formData['status']),
      conditional_reason: toStringOrUndefined(formData['conditional_reason']),
    };

    // Add family/BCC associations
    if (familyId) {
      payload.family_id = familyId;
    }
    if (bccId) {
      payload.bcc_id = bccId;
    }

    // Add marriage-specific fields if applicable
    if (formData['marriage_bride_full_name'] || formData['marriage_groom_full_name']) {
      const brideFullName = formData['marriage_bride_full_name'];
      const groomFullName = formData['marriage_groom_full_name'];
      
      if (brideFullName) {
        payload.marriage_bride_full_name = toStringOrUndefined(brideFullName);
        payload.marriage_bride_father_name = toStringOrUndefined(formData['marriage_bride_father_name']);
        payload.marriage_bride_mother_name = toStringOrUndefined(formData['marriage_bride_mother_name']);
        payload.marriage_bride_address = toStringOrUndefined(formData['marriage_bride_address']);
        const brideChurchType = formData['marriage_bride_church_type'];
        payload.marriage_bride_church_type = (brideChurchType === 'home_parish' || brideChurchType === 'other') 
          ? (brideChurchType as 'home_parish' | 'other') 
          : undefined;
        payload.marriage_bride_church_name = toStringOrUndefined(formData['marriage_bride_church_name']);
        payload.marriage_bride_church_address = toStringOrUndefined(formData['marriage_bride_church_address']);
      }
      
      if (groomFullName) {
        payload.marriage_groom_full_name = toStringOrUndefined(groomFullName);
        payload.marriage_groom_father_name = toStringOrUndefined(formData['marriage_groom_father_name']);
        payload.marriage_groom_mother_name = toStringOrUndefined(formData['marriage_groom_mother_name']);
        payload.marriage_groom_address = toStringOrUndefined(formData['marriage_groom_address']);
        const groomChurchType = formData['marriage_groom_church_type'];
        payload.marriage_groom_church_type = (groomChurchType === 'home_parish' || groomChurchType === 'other') 
          ? (groomChurchType as 'home_parish' | 'other') 
          : undefined;
        payload.marriage_groom_church_name = toStringOrUndefined(formData['marriage_groom_church_name']);
        payload.marriage_groom_church_address = toStringOrUndefined(formData['marriage_groom_church_address']);
      }
    }

    return payload;
  }

  /**
   * Build Baptism participants[] for create (Phase 6).
   * Maps UI drafts + parent/godparent fields to definition roles (godfather/godmother).
   */
  buildBaptismParticipants(input: BaptismParticipantsInput): SacramentParticipantPayload[] {
    const rows: SacramentParticipantPayload[] = [];
    const { formData } = input;

    const recipient = this.recipientPayload(input.recipient, input.affiliation, formData);
    if (recipient) {
      rows.push(recipient);
    }

    const father = this.parentPayload(
      'father',
      String(formData['father_name'] || '').trim(),
      input.selectedFatherId
    );
    if (father) {
      rows.push(father);
    }

    const mother = this.parentPayload(
      'mother',
      String(formData['mother_name'] || '').trim(),
      input.selectedMotherId
    );
    if (mother) {
      rows.push(mother);
    }

    const godfatherName = String(formData['godparent1_name'] || '').trim();
    if (godfatherName) {
      rows.push({
        role: 'godfather',
        source: 'external',
        sort_order: 0,
        external_full_name: godfatherName,
      });
    }

    const godmotherName = String(formData['godparent2_name'] || '').trim();
    if (godmotherName) {
      rows.push({
        role: 'godmother',
        source: 'external',
        sort_order: 0,
        external_full_name: godmotherName,
      });
    }

    const minister = this.ministerPayload(input.minister, formData);
    if (minister) {
      rows.push(minister);
    }

    return rows;
  }

  /**
   * Progressive recipient + minister (+ optional sponsors) — Confirmation / Eucharist / Anointing / Reconciliation.
   */
  buildProgressiveParticipants(input: {
    recipient: SacramentParticipantDraft | null;
    minister: SacramentParticipantDraft | null;
    formData: SacramentFormData;
    includeSponsors?: boolean;
    includeParents?: boolean;
    selectedFatherId?: string | null;
    selectedMotherId?: string | null;
    recipientRole?: 'recipient' | 'candidate';
  }): SacramentParticipantPayload[] {
    const rows: SacramentParticipantPayload[] = [];
    const role = input.recipientRole || 'recipient';

    const recipient = this.namedPersonPayload(role, input.recipient, input.formData, 'recipient_name');
    if (recipient) {
      rows.push(recipient);
    }

    if (input.includeParents) {
      const father = this.parentPayload(
        'father',
        String(input.formData['father_name'] || '').trim(),
        input.selectedFatherId || null
      );
      if (father) {
        rows.push(father);
      }
      const mother = this.parentPayload(
        'mother',
        String(input.formData['mother_name'] || '').trim(),
        input.selectedMotherId || null
      );
      if (mother) {
        rows.push(mother);
      }
    }

    if (input.includeSponsors) {
      const s1 = String(input.formData['godparent1_name'] || '').trim();
      if (s1) {
        rows.push({
          role: 'sponsor',
          source: 'external',
          sort_order: 0,
          external_full_name: s1,
        });
      }
      const s2 = String(input.formData['godparent2_name'] || '').trim();
      if (s2) {
        rows.push({
          role: 'sponsor',
          source: 'external',
          sort_order: 1,
          external_full_name: s2,
        });
      }
    }

    const minister = this.ministerPayload(input.minister, input.formData);
    if (minister) {
      rows.push(minister);
    }

    return rows;
  }

  /**
   * Holy Orders participants: candidate, ordaining minister, co-consecrators, witnesses.
   */
  buildHolyOrdersParticipants(input: {
    candidate: SacramentParticipantDraft | null;
    minister: SacramentParticipantDraft | null;
    coConsecrators: SacramentParticipantDraft[];
    witnesses: SacramentParticipantDraft[];
    formData: SacramentFormData;
  }): SacramentParticipantPayload[] {
    const rows: SacramentParticipantPayload[] = [];

    const candidate = this.namedPersonPayload('candidate', input.candidate, input.formData, 'recipient_name');
    if (candidate) {
      rows.push(candidate);
    }

    const minister = this.ministerPayload(input.minister, input.formData);
    if (minister) {
      rows.push(minister);
    }

    (input.coConsecrators || []).forEach((draft, index) => {
      const row = this.ministerLikePayload('co_consecrator', draft, index);
      if (row) {
        rows.push(row);
      }
    });

    (input.witnesses || []).forEach((draft, index) => {
      const row = this.partyPayload('witness', draft, null, index);
      if (row) {
        rows.push(row);
      }
    });

    return rows;
  }

  private namedPersonPayload(
    role: string,
    draft: SacramentParticipantDraft | null,
    formData: SacramentFormData,
    fallbackNameKey: string
  ): SacramentParticipantPayload | null {
    if (draft?.source === 'member' && draft.family_member_id) {
      return {
        role,
        source: 'member',
        sort_order: 0,
        family_member_id: draft.family_member_id,
      };
    }

    const name = (draft?.external_full_name || draft?.display_name || formData[fallbackNameKey] || '')
      .toString()
      .trim();
    if (!name) {
      return null;
    }

    return {
      role,
      source: 'external',
      sort_order: 0,
      external_full_name: name,
      external_date_of_birth: draft?.external_date_of_birth
        || (formData['recipient_birth_date'] ? String(formData['recipient_birth_date']) : undefined),
      external_gender: (draft?.external_gender || formData['recipient_gender'] || undefined) as
        | 'male'
        | 'female'
        | 'other'
        | undefined,
    };
  }

  private ministerLikePayload(
    role: string,
    draft: SacramentParticipantDraft | null,
    sortOrder = 0
  ): SacramentParticipantPayload | null {
    if (!draft) {
      return null;
    }
    if (draft.source === 'internal_leadership' && (draft.leadership_assignment_id || draft.church_leadership_id)) {
      return {
        role,
        source: 'internal_leadership',
        sort_order: sortOrder,
        leadership_assignment_id: draft.leadership_assignment_id ?? null,
        church_leadership_id: draft.church_leadership_id ?? null,
      };
    }
    const name = (draft.external_full_name || draft.display_name || '').toString().trim();
    if (!name) {
      return null;
    }
    return {
      role,
      source: 'external',
      sort_order: sortOrder,
      external_full_name: name,
      external_title: draft.external_title || undefined,
      external_minister_role: draft.external_minister_role || 'bishop',
    };
  }

  /**
   * Build Matrimony participants[] for create (Phase 7).
   * Bride/groom each carry independent affiliation; witnesses optional 0..N.
   */
  buildMarriageParticipants(input: MarriageParticipantsInput): SacramentParticipantPayload[] {
    const rows: SacramentParticipantPayload[] = [];

    const bride = this.partyPayload('bride', input.bride, input.brideAffiliation);
    if (bride) {
      rows.push(bride);
    }

    const groom = this.partyPayload('groom', input.groom, input.groomAffiliation);
    if (groom) {
      rows.push(groom);
    }

    (input.witnesses || []).forEach((draft, index) => {
      const witness = this.partyPayload('witness', draft, null, index);
      if (witness) {
        rows.push(witness);
      }
    });

    const minister = this.ministerPayload(input.minister, input.formData);
    if (minister) {
      rows.push(minister);
    }

    return rows;
  }

  private partyPayload(
    role: string,
    draft: SacramentParticipantDraft | null,
    affiliation: BaptismAffiliationInput | null,
    sortOrder = 0
  ): SacramentParticipantPayload | null {
    if (!draft) {
      return null;
    }

    if (draft.source === 'member' && draft.family_member_id) {
      return {
        role,
        source: 'member',
        sort_order: sortOrder,
        family_member_id: draft.family_member_id,
        ...(affiliation || {}),
        ...this.canonicalPayload(draft, role),
      };
    }

    const name = (draft.external_full_name || draft.display_name || '').toString().trim();
    if (!name) {
      return null;
    }

    return {
      role,
      source: 'external',
      sort_order: sortOrder,
      external_full_name: name,
      external_date_of_birth: role === 'witness' ? undefined : (draft.external_date_of_birth || undefined),
      external_gender: (draft.external_gender || undefined) as 'male' | 'female' | 'other' | undefined,
      external_address: draft.external_address || undefined,
      external_contact_number: draft.external_contact_number || undefined,
      ...(affiliation || {}),
      ...this.canonicalPayload(draft, role),
    };
  }

  private canonicalPayload(draft: SacramentParticipantDraft, role: string): Partial<SacramentParticipantPayload> {
    if (role !== 'bride' && role !== 'groom' && role !== 'minister') {
      return {};
    }
    return {
      father_name: draft.father_name || undefined,
      mother_name: draft.mother_name || undefined,
      baptismal_status: draft.baptismal_status || undefined,
      ecclesial_affiliation_code: draft.ecclesial_affiliation_code || undefined,
      ecclesial_affiliation_label: draft.ecclesial_affiliation_label || undefined,
    };
  }

  private recipientPayload(
    draft: SacramentParticipantDraft | null,
    affiliation: BaptismAffiliationInput | null,
    formData: SacramentFormData
  ): SacramentParticipantPayload | null {
    if (draft?.source === 'member' && draft.family_member_id) {
      return {
        role: 'recipient',
        source: 'member',
        sort_order: 0,
        family_member_id: draft.family_member_id,
        ...(affiliation || {}),
      };
    }

    const name = (draft?.external_full_name || draft?.display_name || formData['recipient_name'] || '')
      .toString()
      .trim();
    if (!name) {
      return null;
    }

    return {
      role: 'recipient',
      source: 'external',
      sort_order: 0,
      external_full_name: name,
      external_date_of_birth: draft?.external_date_of_birth
        || (formData['recipient_birth_date'] ? String(formData['recipient_birth_date']) : undefined),
      external_gender: (draft?.external_gender || formData['recipient_gender'] || undefined) as
        | 'male'
        | 'female'
        | 'other'
        | undefined,
      ...(affiliation || {}),
    };
  }

  private parentPayload(
    role: 'father' | 'mother',
    name: string,
    memberId: string | null
  ): SacramentParticipantPayload | null {
    if (memberId) {
      return {
        role,
        source: 'member',
        sort_order: 0,
        family_member_id: memberId,
      };
    }
    if (!name) {
      return null;
    }
    return {
      role,
      source: 'external',
      sort_order: 0,
      external_full_name: name,
    };
  }

  private ministerPayload(
    draft: SacramentParticipantDraft | null,
    formData: SacramentFormData
  ): SacramentParticipantPayload | null {
    if (draft?.source === 'internal_leadership' && (draft.leadership_assignment_id || draft.church_leadership_id)) {
      return {
        role: 'minister',
        source: 'internal_leadership',
        sort_order: 0,
        leadership_assignment_id: draft.leadership_assignment_id ?? null,
        church_leadership_id: draft.church_leadership_id ?? null,
      };
    }

    const name = (draft?.external_full_name || draft?.display_name || formData['minister_name'] || '')
      .toString()
      .trim();
    if (!name) {
      return null;
    }

    return {
      role: 'minister',
      source: 'external',
      sort_order: 0,
      external_full_name: name,
      external_title: draft?.external_title
        || (formData['minister_title'] ? String(formData['minister_title']) : undefined),
      external_minister_role: draft?.external_minister_role || 'priest',
    };
  }

  /**
   * Get maximum date for date input (1 day in future)
   */
  getMaxDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + DATE_VALIDATION.MAX_FUTURE_DAYS);
    return tomorrow.toISOString().split('T')[0];
  }

  /**
   * Validate date is not too far in the future
   */
  validateDate(date: string): { valid: boolean; message?: string } {
    if (!date) {
      return { valid: false, message: 'Date is required' };
    }

    const adminDate = new Date(date);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + DATE_VALIDATION.MAX_FUTURE_DAYS);
    tomorrow.setHours(23, 59, 59, 999);

    if (adminDate > tomorrow) {
      return {
        valid: false,
        message: `The date cannot be more than ${DATE_VALIDATION.MAX_FUTURE_DAYS} day(s) in the future`
      };
    }

    return { valid: true };
  }

  /**
   * Format date for HTML date input (YYYY-MM-DD format)
   */
  formatDateForInput(dateValue: string | Date | null | undefined): string {
    if (!dateValue) return '';
    
    // If it's already a string in YYYY-MM-DD format, return it
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateValue)) {
      return dateValue.split('T')[0]; // Remove time portion if present
    }
    
    // If it's a Date object, format it
    if (dateValue instanceof Date) {
      const year = dateValue.getFullYear();
      const month = String(dateValue.getMonth() + 1).padStart(2, '0');
      const day = String(dateValue.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    
    // Try to parse as date string
    try {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (e) {
      // Invalid date
    }
    
    return '';
  }
}

