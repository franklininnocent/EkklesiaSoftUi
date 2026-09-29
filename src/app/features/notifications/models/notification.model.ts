export type NotificationView = 'all' | 'unread' | 'mentions' | 'action_required' | 'archived';

export type NotificationStatus = 'unread' | 'read';
export type ActionStatus = 'none' | 'required' | 'completed' | 'invalid';
export type SubjectStatus = 'available' | 'forbidden' | 'missing';

export interface UserNotification {
  id: string;
  status: NotificationStatus;
  action_status: ActionStatus;
  is_mention: boolean;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  title: string;
  body: string;
  category: string;
  module: string;
  priority: string;
  event_type: string;
  definition_code: string | null;
  actor_display_name: string | null;
  subject_type: string | null;
  subject_id: string | null;
  deep_link?: { route: string; params: Record<string, string> } | null;
  subject_status?: SubjectStatus;
}

export interface NotificationListResponse {
  success: boolean;
  data: UserNotification[];
  meta: {
    next_cursor: string | null;
    has_more: boolean;
    per_page: number;
  };
}

export interface NotificationPreference {
  definition_code: string;
  category: string;
  module: string;
  mandatory: boolean;
  in_app: boolean;
  email: boolean;
  push: boolean;
  digest: string;
}
