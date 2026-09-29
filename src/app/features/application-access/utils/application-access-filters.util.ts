import { ApplicationAccessListParams } from '../models/application-access.model';

export type ApplicationAccessGridTab = 'sessions' | 'events';

export interface ApplicationAccessFilterState {
  q: string;
  status: string;
  identity_type: string;
  access_context: string;
  ip_address: string;
  event_type: string;
  authorization_result: string;
  started_from: string;
  started_to: string;
}

export const EMPTY_APPLICATION_ACCESS_FILTERS: ApplicationAccessFilterState = {
  q: '',
  status: '',
  identity_type: '',
  access_context: '',
  ip_address: '',
  event_type: '',
  authorization_result: '',
  started_from: '',
  started_to: '',
};

export function countActiveApplicationAccessFilters(
  filters: ApplicationAccessFilterState,
  tab: ApplicationAccessGridTab
): number {
  const keys =
    tab === 'sessions'
      ? ['status', 'identity_type', 'access_context', 'ip_address', 'started_from', 'started_to']
      : ['event_type', 'authorization_result', 'ip_address', 'started_from', 'started_to'];

  return keys.filter((key) => {
    const value = filters[key as keyof ApplicationAccessFilterState];
    return value !== undefined && value !== null && String(value).trim() !== '';
  }).length;
}

export function buildApplicationAccessListParams(
  tab: ApplicationAccessGridTab,
  filters: ApplicationAccessFilterState,
  page: number,
  perPage: number
): ApplicationAccessListParams {
  const params: ApplicationAccessListParams = {
    page,
    per_page: perPage,
  };

  if (tab === 'sessions') {
    if (filters.q.trim()) {
      params.q = filters.q.trim();
    }
    if (filters.status) {
      params.status = filters.status;
    }
    if (filters.identity_type) {
      params.identity_type = filters.identity_type;
    }
    if (filters.access_context) {
      params.access_context = filters.access_context;
    }
    if (filters.ip_address.trim()) {
      params.ip_address = filters.ip_address.trim();
    }
    if (filters.started_from) {
      params.started_from = filters.started_from;
    }
    if (filters.started_to) {
      params.started_to = filters.started_to;
    }

    return params;
  }

  if (filters.event_type) {
    params.event_type = filters.event_type;
  }
  if (filters.authorization_result) {
    params.authorization_result = filters.authorization_result;
  }
  if (filters.ip_address.trim()) {
    params.ip_address = filters.ip_address.trim();
  }
  if (filters.started_from) {
    params.from = filters.started_from;
  }
  if (filters.started_to) {
    params.to = filters.started_to;
  }

  return params;
}
