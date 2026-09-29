import { StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';

export interface MassIntentionSaidProgress {
  said: number;
  total: number;
}

export function massIntentionStageLabel(
  status: string,
  _saidProgress?: MassIntentionSaidProgress | null
): string {
  if (status === 'open') {
    return 'Open';
  }
  if (status === 'closed') {
    return 'Closed';
  }
  return status;
}

export function massIntentionStageTone(status: string, _saidProgress?: MassIntentionSaidProgress | null): StatusBadgeTone {
  if (status === 'open') {
    return 'success';
  }
  if (status === 'closed') {
    return 'neutral';
  }
  return 'info';
}

export function massIntentionMassesSaidLabel(_saidProgress?: MassIntentionSaidProgress | null): string {
  return '—';
}

export function massIntentionWorkflowBanner(
  status: string,
  _saidProgress?: MassIntentionSaidProgress | null
): { title: string; detail: string } | null {
  if (status === 'open') {
    return {
      title: 'Open',
      detail: 'This intention stays open through the scheduled day, then closes automatically. You can close it early if needed.',
    };
  }
  if (status === 'closed') {
    return {
      title: 'Closed',
      detail: 'This intention is closed and cannot be edited.',
    };
  }
  return null;
}
