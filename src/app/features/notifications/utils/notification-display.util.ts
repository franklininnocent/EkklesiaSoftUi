import { UserNotification } from '../models/notification.model';
import { StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';

const DEFINITION_LABELS: Record<string, string> = {
  'auth.password_recovery.requested': 'Password recovery approval',
  'auth.password_recovery.approved': 'Password recovery approved',
  'donations.refund.requested': 'Refund approval needed',
  'donations.refund.decided': 'Refund decision',
  'support.emergency_approval.pending': 'Emergency support access',
  'support.ticket.sla_warning': 'Support ticket SLA warning',
  'support.ticket.sla_breach': 'Support ticket SLA breach',
  'tenants.subscription.lifecycle': 'Subscription update',
  'application.security.threat': 'Security alert',
  'pastoral.visit.assigned': 'Pastoral visit assigned',
};

const CATEGORY_LABELS: Record<string, string> = {
  system: 'System & security',
  administration: 'Administration',
  operations: 'Operations',
  church: 'Church & pastoral',
  collaboration: 'Collaboration',
};

export function notificationDefinitionLabel(code: string | null | undefined): string {
  if (!code) {
    return 'Notification';
  }
  return DEFINITION_LABELS[code] ?? code.replace(/\./g, ' · ');
}

export function notificationCategoryLabel(category: string | null | undefined): string {
  if (!category) {
    return 'General';
  }
  return CATEGORY_LABELS[category] ?? category;
}

export function notificationPriorityTone(priority: string | null | undefined): StatusBadgeTone {
  switch (priority) {
    case 'high':
      return 'warning';
    case 'critical':
      return 'critical';
    default:
      return 'neutral';
  }
}

export function notificationModuleInitial(module: string | null | undefined): string {
  if (!module) {
    return 'N';
  }
  return module.trim().charAt(0).toUpperCase();
}

export function isActionRequired(item: UserNotification): boolean {
  return item.action_status === 'required';
}
