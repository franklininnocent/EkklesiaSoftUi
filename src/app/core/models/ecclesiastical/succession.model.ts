import { AppointmentEndReason, CanonicalRole } from './bishop-appointment.model';

export interface ReplaceOrdinaryRequest {
  bishop_id?: number;
  person?: {
    full_name: string;
    given_name?: string;
    family_name?: string;
    religious_name?: string;
    date_of_birth?: string;
    email?: string;
    phone?: string;
  };
  appointment: {
    effective_date: string;
    appointed_date?: string;
    announced_date?: string;
    installed_date?: string;
    ecclesiastical_title_id?: number;
    canonical_role?: CanonicalRole;
  };
  end_reason?: AppointmentEndReason;
}

export interface ReplaceOrdinaryResponse {
  ended: unknown | null;
  created: unknown;
  bishop_id: number;
}
