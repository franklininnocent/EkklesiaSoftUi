import { SupportTicketDetail } from '../../support/models/support-ticket.model';

export interface OpsSupportTicketRow {
  ticket_number: string;
  subject: string;
  status: string;
  priority: string;
  tenant?: { id: number; name: string };
  updated_at?: string;
}

export interface OpsSupportTicketMetrics {
  open: number;
  unassigned: number;
  sla_at_risk: number;
}

export interface OpsSupportTicketDetail extends SupportTicketDetail {
  tenant?: { id: number; name: string };
  queue?: { id: number; slug: string; name: string };
  assigned_agent?: { id: number; name: string };
  internal_comments?: {
    id: number;
    body: string;
    author?: { id: number; name: string };
    created_at?: string;
  }[];
  root_cause?: string | null;
  workaround?: string | null;
  permanent_fix?: string | null;
}

export interface OpsSupportTicketListResponse {
  success: boolean;
  data: OpsSupportTicketRow[] | { data?: OpsSupportTicketRow[] };
  total?: number;
}
