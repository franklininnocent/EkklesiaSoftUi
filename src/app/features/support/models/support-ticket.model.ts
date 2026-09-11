export interface SupportTicketDashboard {
  open: number;
  awaiting_ekklesia: number;
  awaiting_you: number;
  resolved: number;
  total: number;
  sla_at_risk: number;
}

export interface SupportLookupType {
  id: number;
  slug: string;
  name: string;
  requires_bug_fields?: boolean;
  categories?: { id: number; name: string }[];
}

export interface SupportTicketListItem {
  id: number;
  ticket_number: string;
  subject: string;
  request_type?: { id: number; slug: string; name: string };
  category?: { id: number; name: string };
  priority: string;
  status: string;
  affected_module?: string | null;
  requester?: { id: number; name: string };
  sla?: {
    at_risk?: boolean;
    resolution_due_at?: string | null;
    resolved_at?: string | null;
  };
  created_at?: string;
  updated_at?: string;
}

export interface SupportTicketDetail extends SupportTicketListItem {
  description?: string;
  steps_to_reproduce?: string | null;
  expected_result?: string | null;
  actual_result?: string | null;
  error_message?: string | null;
  bug_details?: Record<string, string> | null;
  business_impact?: string | null;
  comments?: { id: number; body: string; author?: { id: number; name: string }; created_at?: string }[];
  attachments?: { id: number; original_name: string; mime_type: string; size_bytes: number }[];
  participants?: { user_id: number; name?: string }[];
  activity?: {
    event_type: string;
    old_value?: string | null;
    new_value?: string | null;
    reason?: string | null;
    actor?: { id: number; name: string };
    created_at?: string;
  }[];
  resolution_summary?: string | null;
  resolution_category?: string | null;
  resolution_method?: string | null;
  reopen_allowed_until?: string | null;
  resolved_by_user_id?: number | null;
  resolved_by_actor?: 'tenant' | 'ekklesia' | null;
  resolved_by?: { id: number; name: string } | null;
}

export interface CreateSupportTicketPayload {
  request_type_id: number;
  category_id?: number | null;
  subcategory_id?: number | null;
  subject: string;
  description: string;
  priority?: string;
  business_impact?: string;
  affected_module?: string;
  occurrence_at?: string;
  steps_to_reproduce?: string;
  expected_result?: string;
  actual_result?: string;
  error_message?: string;
  bug_details?: {
    frequency?: string;
    browser?: string;
    device?: string;
  };
  submit?: boolean;
}
