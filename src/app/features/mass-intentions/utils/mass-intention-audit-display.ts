import { StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { MassIntentionAuditRow } from '../services/mass-intentions-api.service';

export const AUDIT_CATEGORY_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'intention', label: 'Intention' },
  { value: 'mass', label: 'Mass' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'transfer', label: 'Transfer' },
];

const EVENT_LABELS: Record<string, string> = {
  'request.created': 'Intention recorded',
  'request.updated': 'Intention updated',
  'request.closed': 'Intention closed',
  'request.accepted': 'Intention accepted',
  'request.withdrawn': 'Intention withdrawn',
  'intention.assigned': 'Assigned to a Mass',
  'intention.moved': 'Moved to another Mass',
  'receipt.voided': 'Receipt voided',
  'celebration.created': 'One-time Mass added',
  'celebration.cancelled': 'Mass cancelled',
  'celebration.schedule_changed': 'Mass updated (schedule change)',
  'celebration.schedule_applied': 'New Mass time applied',
  'celebration.schedule_kept': 'Mass kept on calendar',
  'schedule.draft_saved': 'Schedule draft saved',
  'schedule.applied': 'Schedule published to calendar',
  'schedule.inactivated': 'Temporary schedule ended',
  'schedule.archived': 'Schedule archived',
  'day_override.saved': 'Special day draft saved',
  'day_override.applied': 'Special day published',
  'day_override.inactivated': 'Special day removed',
  'transfer.initiated': 'Transfer sent',
  'transfer.accepted': 'Transfer accepted',
  'transfer.rejected': 'Transfer declined',
  'transfer.received': 'Transfer received',
  'transfer.declined': 'Transfer declined (sending parish)',
};

const EVENT_CATEGORY: Record<string, string> = {
  'request.created': 'Intention',
  'request.updated': 'Intention',
  'request.closed': 'Intention',
  'request.accepted': 'Intention',
  'request.withdrawn': 'Intention',
  'intention.assigned': 'Intention',
  'intention.moved': 'Intention',
  'receipt.voided': 'Intention',
  'celebration.created': 'Mass',
  'celebration.cancelled': 'Mass',
  'celebration.schedule_changed': 'Mass',
  'celebration.schedule_applied': 'Mass',
  'celebration.schedule_kept': 'Mass',
  'schedule.draft_saved': 'Schedule',
  'schedule.applied': 'Schedule',
  'schedule.inactivated': 'Schedule',
  'schedule.archived': 'Schedule',
  'day_override.saved': 'Schedule',
  'day_override.applied': 'Schedule',
  'day_override.inactivated': 'Schedule',
  'transfer.initiated': 'Transfer',
  'transfer.accepted': 'Transfer',
  'transfer.rejected': 'Transfer',
  'transfer.received': 'Transfer',
  'transfer.declined': 'Transfer',
};

export function auditEventLabel(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType.replaceAll('.', ' · ');
}

export function auditEventTypeFilterOptions(): Array<{ value: string; label: string }> {
  return Object.entries(EVENT_LABELS)
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function auditEventCategory(eventType: string): string {
  return EVENT_CATEGORY[eventType] ?? 'Other';
}

export function auditEventCategoryTone(eventType: string): StatusBadgeTone {
  const category = auditEventCategory(eventType);
  if (category === 'Intention') {
    return 'success';
  }
  if (category === 'Mass') {
    return 'info';
  }
  if (category === 'Schedule') {
    return 'neutral';
  }
  if (category === 'Transfer') {
    return 'warning';
  }
  return 'neutral';
}

export interface AuditWhenParts {
  date: string;
  time: string;
}

export function formatAuditWhen(iso: string | null | undefined): AuditWhenParts | null {
  if (!iso) {
    return null;
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return { date: iso, time: '' };
  }
  return {
    date: new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(d),
    time: new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(d),
  };
}

export interface AuditRelatedLink {
  label: string;
  routerLink: string[];
  queryParams?: Record<string, string>;
}

export function auditRelatedLink(row: MassIntentionAuditRow): AuditRelatedLink | null {
  if (row.request_id) {
    return {
      label: 'View intention',
      routerLink: ['/mass-intentions/intentions'],
      queryParams: { view: row.request_id },
    };
  }
  if (row.celebration_id) {
    return {
      label: 'View Mass',
      routerLink: ['/mass-intentions/masses', row.celebration_id],
    };
  }
  const scheduleId = row.payload?.['schedule_id'];
  if (typeof scheduleId === 'string' && scheduleId) {
    if (row.payload?.['kind'] === 'temporary') {
      return {
        label: 'Temporary schedule',
        routerLink: ['/mass-intentions/masses/temporaries', scheduleId],
      };
    }
    return {
      label: 'Weekly schedule',
      routerLink: ['/mass-intentions/masses/schedule'],
    };
  }
  return null;
}
