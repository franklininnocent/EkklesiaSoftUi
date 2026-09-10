export type CanonicalRole =
  | 'diocesan_bishop'
  | 'archbishop'
  | 'auxiliary'
  | 'coadjutor'
  | 'apostolic_administrator'
  | 'diocesan_administrator';

export type AppointmentStatus = 'current' | 'future' | 'ended';
export type AppointmentEndReason =
  | 'resignation'
  | 'transfer'
  | 'retirement'
  | 'death'
  | 'removal'
  | 'appointment_ended'
  | 'other';

export interface BishopAppointment {
  id: string;
  bishop_id: number;
  diocese_id: number;
  ecclesiastical_title_id?: number;
  canonical_role: CanonicalRole;
  appointed_date?: string;
  announced_date?: string;
  effective_date?: string;
  ordained_date?: string;
  installed_date?: string;
  ended_date?: string;
  end_reason?: AppointmentEndReason;
  is_current: boolean;
  appointment_status?: AppointmentStatus;
  appointment_details?: string;
  diocese?: { id: number; name: string; code?: string };
  ecclesiastical_title?: { id: number; title: string };
  bishop?: {
    id: number;
    full_name?: string;
    photo_url?: string;
    photo_path?: string;
    photo_public_url?: string;
    has_photo?: boolean;
  };
}

export interface CreateAppointmentRequest {
  diocese_id: number;
  canonical_role: CanonicalRole;
  effective_date: string;
  appointed_date?: string;
  announced_date?: string;
  installed_date?: string;
  ecclesiastical_title_id?: number;
  is_current?: boolean;
}

export interface EndAppointmentRequest {
  ended_date: string;
  end_reason: AppointmentEndReason;
}
