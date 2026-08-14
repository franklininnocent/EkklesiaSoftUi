/** Sacrament definition contract from GET /sacraments/definitions (ADR-06). */

export type SacramentParticipantClassification = 'required' | 'recommended' | 'optional';

export interface SacramentDefinitionParticipantSlot {
  role: string;
  min: number;
  max: number | null;
  classification: SacramentParticipantClassification;
  allowed_sources: string[];
  affiliation_required_when_other?: boolean;
}

export interface SacramentDefinition {
  code: string;
  display_name?: string;
  category?: string;
  workflow: string;
  batch_supported: boolean;
  repeatable?: boolean;
  repeatability_policy?: string;
  privacy_class: string;
  certificate_supported: boolean;
  certificate_template_key?: string | null;
  review_required: boolean;
  phase?: string;
  gated?: boolean;
  export_allowed?: boolean;
  affiliation_independent_of_source?: boolean;
  minister_roles: string[];
  default_event_subtype?: string;
  event_subtypes?: string[];
  place_classifications?: string[];
  ordination_types?: string[];
  forbidden_fields?: string[];
  registry_policy?: Record<string, string>;
  typed_attributes_schema?: Record<string, unknown>;
  participants: SacramentDefinitionParticipantSlot[];
  fields: {
    minimum: string[];
    recommended: string[];
    complete: string[];
  };
}

export interface SacramentDefinitionsResponse {
  success: boolean;
  data: SacramentDefinition[];
  message?: string;
  meta?: {
    participants_v1?: boolean;
  };
}

/** Draft participant value edited by shared controls (posted as participants[] on Baptism create — Phase 6). */
export type ParticipantSourceKind = 'member' | 'internal_leadership' | 'external';

export interface SacramentParticipantDraft {
  role: string;
  source: ParticipantSourceKind;
  sort_order?: number;
  family_member_id?: string | null;
  church_leadership_id?: number | null;
  display_name?: string;
  external_full_name?: string;
  external_date_of_birth?: string;
  external_gender?: 'male' | 'female' | 'other' | '';
  external_address?: string;
  external_contact_number?: string;
  external_title?: string;
  external_minister_role?: string;
  affiliation_type?: 'home_parish' | 'other' | null;
  affiliation_parish_name?: string;
  affiliation_parish_address?: string;
  affiliation_diocese_name?: string;
  affiliation_diocese_region?: string;
  affiliation_diocese_country?: string;
}

export type SacramentWorkflowSectionKey =
  | 'basic'
  | 'recipient'
  | 'candidate'
  | 'parents'
  | 'godparents'
  | 'sponsors'
  | 'bride'
  | 'groom'
  | 'witnesses'
  | 'minister'
  | 'co_consecrators'
  | 'ordination'
  | 'affiliation'
  | 'place_classification'
  | 'event_subtype'
  | 'registry'
  | 'notes'
  | 'review';

export interface SacramentWorkflowPlan {
  code: string;
  sections: SacramentWorkflowSectionKey[];
  reviewRequired: boolean;
  batchSupported: boolean;
  definition: SacramentDefinition | null;
}
