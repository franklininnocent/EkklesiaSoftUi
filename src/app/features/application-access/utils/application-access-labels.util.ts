import { StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';

const IDENTITY_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  EKKLESIA_USER: 'Ekklesia user',
  SUPPORT_OPERATOR: 'Support operator',
  AUTHENTICATED_TENANT_USER: 'Parish user',
  AUTHENTICATED_USER_WITHOUT_TENANT: 'Signed-in user',
  ANONYMOUS_VISITOR: 'Visitor',
  UNKNOWN_USER: 'Unknown',
};

const CONTEXT_LABELS: Record<string, string> = {
  PUBLIC: 'Public',
  AUTHENTICATION: 'Sign-in',
  TENANT: 'Parish',
  EKKLESIA: 'Ekklesia',
  SUPPORT: 'Support',
  API: 'API',
  SYSTEM: 'System',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Signed in',
  IDLE: 'Idle',
  ENDED: 'Signed out',
  EXPIRED: 'Expired',
  REVOKED: 'Revoked',
};

export function identityLabel(value: string | null | undefined): string {
  if (!value) {
    return 'Unknown';
  }

  return IDENTITY_LABELS[value] ?? value.replaceAll('_', ' ').toLowerCase();
}

export function contextLabel(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  return CONTEXT_LABELS[value] ?? value;
}

export function sessionStatusLabel(value: string | null | undefined): string {
  if (!value) {
    return 'Unknown';
  }

  return STATUS_LABELS[value] ?? value;
}

export function riskTone(level: string | null | undefined): StatusBadgeTone {
  switch ((level || '').toUpperCase()) {
    case 'CRITICAL':
    case 'HIGH':
      return 'critical';
    case 'MEDIUM':
      return 'warning';
    case 'LOW':
      return 'success';
    default:
      return 'neutral';
  }
}

export function sessionStatusTone(status: string | null | undefined): StatusBadgeTone {
  switch ((status || '').toUpperCase()) {
    case 'ACTIVE':
      return 'success';
    case 'IDLE':
      return 'info';
    case 'REVOKED':
      return 'critical';
    case 'EXPIRED':
    case 'ENDED':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function authorizationResultLabel(value: string | null | undefined): string {
  if (!value) {
    return '—';
  }

  return value === 'denied' ? 'Blocked' : 'Allowed';
}

export function authorizationResultTone(value: string | null | undefined): StatusBadgeTone {
  return value === 'denied' ? 'critical' : 'success';
}
