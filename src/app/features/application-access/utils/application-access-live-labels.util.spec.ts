import { ApplicationAccessStreamTelemetry } from '../models/application-access-stream.model';
import { isHighRiskTelemetry, liveTelemetryLabel } from './application-access-live-labels.util';

describe('application-access-live-labels.util', () => {
  it('formats security telemetry with reason code', () => {
    const event: ApplicationAccessStreamTelemetry = {
      stream_id: '1',
      stream_type: 'security',
      occurred_at: '2026-01-01T00:00:00Z',
      payload: { event_type: 'LOGIN_FAILURE', reason_code: 'invalid_credentials' },
    };

    expect(liveTelemetryLabel(event)).toBe('LOGIN_FAILURE (invalid_credentials)');
  });

  it('formats activity telemetry with normalized route', () => {
    const event: ApplicationAccessStreamTelemetry = {
      stream_id: '2',
      stream_type: 'access',
      occurred_at: '2026-01-01T00:00:00Z',
      payload: { event_type: 'VIEW', normalized_route: '/api/families/{id}' },
    };

    expect(liveTelemetryLabel(event)).toBe('VIEW · /api/families/{id}');
  });

  it('flags high severity security events', () => {
    const event: ApplicationAccessStreamTelemetry = {
      stream_id: '3',
      stream_type: 'security',
      occurred_at: '2026-01-01T00:00:00Z',
      payload: { severity: 'HIGH' },
    };

    expect(isHighRiskTelemetry(event)).toBe(true);
  });

  it('flags denied authorization on activity events', () => {
    const event: ApplicationAccessStreamTelemetry = {
      stream_id: '4',
      stream_type: 'access',
      occurred_at: '2026-01-01T00:00:00Z',
      payload: { authorization_result: 'denied' },
    };

    expect(isHighRiskTelemetry(event)).toBe(true);
  });
});
