export type PastoralCareStatus = 'open' | 'assigned' | 'done' | 'cancelled';
export type PastoralCareType = 'hospital_visit' | 'home_visit' | 'bereavement' | 'other';
export type PastoralCarePriority = 'urgent' | 'routine';

export interface PastoralCareRequest {
  id: string;
  family_id: string;
  family_name: string;
  person_id?: string | null;
  type: PastoralCareType;
  type_label: string;
  priority: PastoralCarePriority;
  status: PastoralCareStatus;
  summary: string;
  notes?: string | null;
  title: string;
  assignee: string;
  assigned_to_user_id?: number | null;
  due_on?: string | null;
  due: string;
  created_at?: string;
}

export interface PastoralCareStaff {
  id: number;
  name: string;
}

export interface PastoralCareAlert {
  id: string;
  title: string;
  count: number;
  priority: 'urgent' | 'normal';
  action: string;
}

export interface PastoralCareDashboard {
  open_count: number;
  assigned_count: number;
  alerts: PastoralCareAlert[];
  tasks: PastoralCareRequest[];
}

export interface CreatePastoralCarePayload {
  family_id: string;
  person_id?: string | null;
  type: PastoralCareType;
  priority?: PastoralCarePriority;
  summary: string;
  notes?: string | null;
  due_on?: string | null;
}
