export type BishopUpdateRequestType =
  | 'create_bishop'
  | 'update_bishop'
  | 'change_current_bishop'
  | 'add_auxiliary'
  | 'add_coadjutor'
  | 'update_appointment'
  | 'update_image'
  | 'correct_information';

export type BishopUpdateRequestStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'changes_requested'
  | 'approved'
  | 'applied'
  | 'rejected';

export interface BishopUpdateRequestItem {
  id: string;
  tenant_id: number;
  diocese_id: number;
  target_bishop_id?: number;
  request_type: BishopUpdateRequestType;
  proposed_bishop_data?: Record<string, unknown>;
  proposed_appointment_data?: Record<string, unknown>;
  supporting_information?: string;
  source_reference?: string;
  submission_notes?: string;
  status: BishopUpdateRequestStatus;
  submitted_at?: string;
  reviewer_comments?: string;
  submitter_feedback?: string;
  reviewed_at?: string;
  applied_at?: string;
  version: number;
  is_editable?: boolean;
  submitted_by?: number;
  submitted_by_user?: { id: number; name: string };
  reviewer?: { id: number; name: string };
  pending_photo_public_url?: string;
  internal_reviewer_notes?: string;
  diocese?: { id: number; name: string };
  target_bishop?: { id: number; full_name: string; photo_public_url?: string };
  tenant?: { id: number; name: string };
}

export interface BishopUpdateRequestDiff {
  current_leadership?: Record<string, unknown>;
  current_bishop?: Record<string, unknown>;
  proposed_bishop?: Record<string, unknown>;
  proposed_appointment?: Record<string, unknown>;
  proposed_photo_public_url?: string | null;
  request_type?: string;
  potential_duplicate_bishop_ids?: number[];
}

export interface BishopUpdateRequestReview {
  request: BishopUpdateRequestItem;
  diff: BishopUpdateRequestDiff;
}
