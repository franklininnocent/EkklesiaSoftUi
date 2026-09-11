import {
  buildApplicationAccessListParams,
  countActiveApplicationAccessFilters,
  EMPTY_APPLICATION_ACCESS_FILTERS,
} from './application-access-filters.util';

describe('application-access-filters.util', () => {
  it('counts only session drawer filters for the sessions tab', () => {
    const count = countActiveApplicationAccessFilters(
      {
        ...EMPTY_APPLICATION_ACCESS_FILTERS,
        status: 'ACTIVE',
        event_type: 'VIEW',
        started_from: '2026-09-01',
      },
      'sessions'
    );

    expect(count).toBe(2);
  });

  it('builds session list params with plain-language filters', () => {
    const params = buildApplicationAccessListParams(
      'sessions',
      {
        ...EMPTY_APPLICATION_ACCESS_FILTERS,
        q: 'smith',
        status: 'ACTIVE',
        identity_type: 'EKKLESIA_USER',
        access_context: 'EKKLESIA',
        ip_address: '203.0.113.10',
        started_from: '2026-09-01',
        started_to: '2026-09-11',
      },
      2,
      25
    );

    expect(params).toEqual({
      page: 2,
      per_page: 25,
      q: 'smith',
      status: 'ACTIVE',
      identity_type: 'EKKLESIA_USER',
      access_context: 'EKKLESIA',
      ip_address: '203.0.113.10',
      started_from: '2026-09-01',
      started_to: '2026-09-11',
    });
  });

  it('maps event date filters to from/to query params', () => {
    const params = buildApplicationAccessListParams(
      'events',
      {
        ...EMPTY_APPLICATION_ACCESS_FILTERS,
        event_type: 'VIEW',
        authorization_result: 'denied',
        ip_address: '198.51.100.4',
        started_from: '2026-09-01',
        started_to: '2026-09-11',
      },
      1,
      50
    );

    expect(params).toEqual({
      page: 1,
      per_page: 50,
      event_type: 'VIEW',
      authorization_result: 'denied',
      ip_address: '198.51.100.4',
      from: '2026-09-01',
      to: '2026-09-11',
    });
  });
});
