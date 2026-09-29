import { parseSseBuffer } from './application-access-sse-parser.util';

describe('application-access-sse-parser.util', () => {
  it('parses telemetry SSE messages and keeps partial remainder', () => {
    const chunk =
      ': ping\n\n' +
      'id: access:abc\n' +
      'event: telemetry\n' +
      'data: {"stream_type":"access","payload":{"event_type":"VIEW"}}\n\n' +
      'event: recon';

    const result = parseSseBuffer(chunk);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toEqual({
      id: 'access:abc',
      event: 'telemetry',
      data: '{"stream_type":"access","payload":{"event_type":"VIEW"}}',
    });
    expect(result.remainder).toBe('event: recon');
  });
});
