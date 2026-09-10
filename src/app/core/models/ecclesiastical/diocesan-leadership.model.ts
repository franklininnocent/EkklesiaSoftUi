export type DioceseLeadershipState = 'active' | 'vacant' | 'administrator' | 'unknown';

export interface DiocesanAppointmentSummary {
  appointment_id: string;
  bishop_id: number;
  bishop_name?: string;
  photo_url?: string;
  photo_public_url?: string;
  has_photo?: boolean;
  canonical_role?: string;
  title?: string;
  announced_date?: string;
  effective_date?: string;
  installed_date?: string;
  ended_date?: string;
  is_current?: boolean;
  appointment_status?: string;
}

export interface DiocesanLeadership {
  diocese_id: number;
  diocese_name?: string;
  diocese_code?: string;
  leadership_state: DioceseLeadershipState;
  last_verified_at?: string;
  ordinary: DiocesanAppointmentSummary | null;
  current_appointments: DiocesanAppointmentSummary[];
}
