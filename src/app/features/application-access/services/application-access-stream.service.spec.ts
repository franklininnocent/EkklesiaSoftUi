import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ApplicationAccessApiService } from './application-access-api.service';
import { ApplicationAccessStreamService } from './application-access-stream.service';

describe('ApplicationAccessStreamService', () => {
  let service: ApplicationAccessStreamService;
  const auth: {
    getToken: jest.Mock;
    getRefreshToken: jest.Mock;
    refreshTokens: jest.Mock;
    clearAuthState: jest.Mock;
  } = {
    getToken: jest.fn(() => 'token'),
    getRefreshToken: jest.fn(() => null),
    refreshTokens: jest.fn(),
    clearAuthState: jest.fn(),
  };

  beforeEach(() => {
    jest.restoreAllMocks();

    TestBed.configureTestingModule({
      providers: [
        ApplicationAccessStreamService,
        { provide: AuthService, useValue: auth },
        {
          provide: ApplicationAccessApiService,
          useValue: {
            getDashboard: jest.fn(() =>
              of({
                generated_at: '2026-09-11T00:00:00Z',
                windows: {} as any,
                kpis: {
                  active_sessions: 1,
                  failed_sign_ins_15m: 0,
                  blocked_attempts_15m: 0,
                  support_sessions: 0,
                  needs_attention_15m: 0,
                  failed_sign_ins_today_utc: 0,
                  blocked_attempts_today_utc: 0,
                },
              })
            ),
            listEvents: jest.fn(() =>
              of({
                data: [
                  {
                    id: 'evt-1',
                    event_type: 'VIEW',
                    occurred_at: '2026-09-11T00:00:00Z',
                  },
                ],
                meta: { current_page: 1, per_page: 25, total: 1, last_page: 1 },
              })
            ),
          },
        },
      ],
    });

    service = TestBed.inject(ApplicationAccessStreamService);
  });

  it('disconnect stops an active connection', () => {
    service.connect();
    service.disconnect();
    expect(service.connectionState()).toBe('stopped');
  });

  it('falls back to polling when stream endpoint is unavailable', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      status: 503,
      ok: false,
      body: null,
    } as Response);

    service.connect();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(service.connectionState()).toBe('polling');
    service.disconnect();
  });

  it('sends Last-Event-ID on reconnect after receiving stream ids', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        body: {
          getReader: () => {
            let delivered = false;
            return {
              read: async () => {
                if (delivered) {
                  return { done: true, value: undefined };
                }
                delivered = true;
                const chunk = new TextEncoder().encode(
                  'id: access:evt-1\nevent: telemetry\ndata: {"stream_type":"access","occurred_at":"2026-09-11T00:00:00Z","payload":{"event_type":"VIEW"}}\n\n'
                );
                return { done: false, value: chunk };
              },
            };
          },
        },
      } as Response)
      .mockResolvedValueOnce({
        status: 503,
        ok: false,
        body: null,
      } as Response);

    globalThis.fetch = fetchMock;

    service.connect();
    await new Promise((resolve) => setTimeout(resolve, 0));
    service.disconnect();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalled();
    const firstHeaders = (fetchMock.mock.calls[0]?.[1] as RequestInit | undefined)?.headers as
      | Record<string, string>
      | undefined;
    expect(firstHeaders?.['Last-Event-ID']).toBeUndefined();

    service.connect();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const secondHeaders = (fetchMock.mock.calls.at(-1)?.[1] as RequestInit | undefined)?.headers as
      | Record<string, string>
      | undefined;
    expect(secondHeaders?.['Last-Event-ID']).toBe('access:evt-1');

    service.disconnect();
  });

  it('clears auth only after refresh retry fails on 401', async () => {
    auth.getRefreshToken.mockReturnValue('refresh');
    auth.refreshTokens.mockReturnValue(throwError(() => new Error('refresh failed')));

    globalThis.fetch = jest.fn().mockResolvedValue({
      status: 401,
      ok: false,
      body: null,
    } as Response);

    service.connect();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(auth.clearAuthState).toHaveBeenCalled();
    expect(service.connectionState()).toBe('stopped');
  });
});
