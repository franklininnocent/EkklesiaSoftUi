import { pushLiveTelemetryEvent } from './application-access-live-buffer.util';
import { ApplicationAccessStreamTelemetry } from '../models/application-access-stream.model';

function event(id: string): ApplicationAccessStreamTelemetry {
  return {
    stream_id: id,
    stream_type: 'access',
    occurred_at: '2026-09-11T00:00:00Z',
    payload: { event_type: 'VIEW' },
  };
}

describe('application-access-live-buffer.util', () => {
  it('deduplicates by stream id and caps buffer size', () => {
    const seen = new Set<string>();
    let buffer: ApplicationAccessStreamTelemetry[] = [];

    for (let index = 0; index < 105; index++) {
      buffer = pushLiveTelemetryEvent(buffer, event(`access:${index}`), seen, 100);
    }

    expect(buffer).toHaveLength(100);
    expect(buffer[0].stream_id).toBe('access:104');

    const duplicateAttempt = pushLiveTelemetryEvent(buffer, event('access:104'), seen, 100);
    expect(duplicateAttempt).toHaveLength(100);
    expect(duplicateAttempt[0].stream_id).toBe('access:104');
  });
});
