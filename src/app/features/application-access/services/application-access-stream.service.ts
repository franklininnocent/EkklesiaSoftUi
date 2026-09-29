import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '@environments/environment';
import { AuthService } from '@core/services/auth.service';
import {
  ApplicationAccessStreamConnectionState,
  ApplicationAccessStreamTelemetry,
} from '../models/application-access-stream.model';
import { parseSseBuffer } from '../utils/application-access-sse-parser.util';
import { pushLiveTelemetryEvent } from '../utils/application-access-live-buffer.util';
import { isHighRiskTelemetry, liveTelemetryLabel } from '../utils/application-access-live-labels.util';
import { ApplicationAccessApiService } from './application-access-api.service';

const POLL_INTERVAL_MS = 15_000;
const MAX_BUFFER_SIZE = 100;
const LIVE_ANNOUNCEMENT_THROTTLE_MS = 3_000;
const ALERT_DEBOUNCE_MS = 5_000;

@Injectable({ providedIn: 'root' })
export class ApplicationAccessStreamService {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApplicationAccessApiService);

  readonly connectionState = signal<ApplicationAccessStreamConnectionState>('stopped');
  readonly liveEvents = signal<ApplicationAccessStreamTelemetry[]>([]);
  readonly politeAnnouncement = signal<string | null>(null);
  readonly alertAnnouncement = signal<string | null>(null);

  private abortController: AbortController | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly seenIds = new Set<string>();
  private lastEventId: string | null = null;
  private reconnectAttempt = 0;
  private active = false;
  private retriedAuth = false;
  private lastPoliteAnnouncementAt = 0;
  private alertDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  connect(): void {
    if (this.active) {
      return;
    }

    this.active = true;
    this.retriedAuth = false;
    this.reconnectAttempt = 0;
    this.openStream();
  }

  disconnect(): void {
    this.active = false;
    this.clearReconnectTimer();
    this.stopPolling();
    this.abortController?.abort();
    this.abortController = null;
    this.connectionState.set('stopped');
    this.politeAnnouncement.set(null);
    this.alertAnnouncement.set(null);
  }

  private async openStream(): Promise<void> {
    if (!this.active) {
      return;
    }

    this.clearReconnectTimer();
    this.stopPolling();
    this.abortController?.abort();

    const controller = new AbortController();
    this.abortController = controller;
    this.connectionState.set(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');

    const token = this.auth.getToken();
    if (!token) {
      this.connectionState.set('stopped');
      return;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: 'text/event-stream',
    };

    if (this.lastEventId) {
      headers['Last-Event-ID'] = this.lastEventId;
    }

    try {
      const response = await fetch(`${environment.apiUrl}/admin/application-access/stream`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (response.status === 401) {
        const recovered = await this.tryRefreshAndRetry();
        if (!recovered) {
          this.auth.clearAuthState();
          this.disconnect();
        }
        return;
      }

      if (response.status === 503 || !response.ok || !response.body) {
        this.startPollingFallback();
        return;
      }

      this.reconnectAttempt = 0;
      this.connectionState.set('live');
      this.politeAnnouncement.set('Live updates connected.');

      let partial = '';
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (this.active) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        partial += decoder.decode(value, { stream: true });
        const parsed = parseSseBuffer(partial);
        partial = parsed.remainder;

        for (const message of parsed.messages) {
          this.handleSseMessage(message);
        }
      }

      if (this.active) {
        this.scheduleReconnect();
      }
    } catch (error) {
      if (!this.active || controller.signal.aborted) {
        return;
      }

      this.startPollingFallback();
    }
  }

  private handleSseMessage(message: { id?: string; event?: string; data?: string }): void {
    if (message.id) {
      this.lastEventId = message.id;
    }

    if (message.event === 'reconnect' || message.event === 'replaced') {
      this.scheduleReconnect(250);
      return;
    }

    if (message.event !== 'telemetry' || !message.data) {
      return;
    }

    try {
      const envelope = JSON.parse(message.data) as {
        stream_type?: ApplicationAccessStreamTelemetry['stream_type'];
        occurred_at?: string;
        payload?: Record<string, unknown>;
      };

      const telemetry: ApplicationAccessStreamTelemetry = {
        stream_id: message.id ?? `${envelope.stream_type}:${String(envelope.payload?.['id'] ?? Date.now())}`,
        stream_type: envelope.stream_type === 'security' ? 'security' : 'access',
        occurred_at: envelope.occurred_at ?? new Date().toISOString(),
        payload: envelope.payload ?? {},
      };

      this.liveEvents.update((events) => pushLiveTelemetryEvent(events, telemetry, this.seenIds, MAX_BUFFER_SIZE));
      this.announceTelemetry(telemetry);
    } catch {
      // Ignore malformed stream payloads.
    }
  }

  private announceTelemetry(event: ApplicationAccessStreamTelemetry): void {
    const label = liveTelemetryLabel(event);
    const now = Date.now();

    if (isHighRiskTelemetry(event)) {
      if (this.alertDebounceTimer) {
        clearTimeout(this.alertDebounceTimer);
      }

      this.alertDebounceTimer = setTimeout(() => {
        this.alertAnnouncement.set(`Attention: ${label}`);
        this.alertDebounceTimer = null;
      }, ALERT_DEBOUNCE_MS);
      return;
    }

    if (now - this.lastPoliteAnnouncementAt < LIVE_ANNOUNCEMENT_THROTTLE_MS) {
      return;
    }

    this.lastPoliteAnnouncementAt = now;
    this.politeAnnouncement.set(`Live update: ${label}`);
  }

  private async tryRefreshAndRetry(): Promise<boolean> {
    if (this.retriedAuth) {
      return false;
    }

    const refreshToken = this.auth.getRefreshToken();
    if (!refreshToken) {
      return false;
    }

    this.retriedAuth = true;

    try {
      await firstValueFrom(this.auth.refreshTokens(refreshToken));
      await this.openStream();
      return true;
    } catch {
      return false;
    }
  }

  private scheduleReconnect(delayMs?: number): void {
    if (!this.active) {
      return;
    }

    this.clearReconnectTimer();
    const delay = delayMs ?? Math.min(30_000, 1_000 * 2 ** this.reconnectAttempt);
    this.reconnectAttempt += 1;
    this.connectionState.set('reconnecting');
    this.politeAnnouncement.set('Live updates paused — reconnecting');

    this.reconnectTimer = setTimeout(() => {
      this.openStream();
    }, delay);
  }

  private startPollingFallback(): void {
    if (!this.active) {
      return;
    }

    this.abortController?.abort();
    this.connectionState.set('polling');
    this.politeAnnouncement.set('Live stream unavailable — polling every 15 seconds.');

    this.stopPolling();
    this.pollTimer = setInterval(() => {
      void this.pollRecentEvents();
    }, POLL_INTERVAL_MS);

    void this.pollRecentEvents();
  }

  private async pollRecentEvents(): Promise<void> {
    if (!this.active) {
      return;
    }

    try {
      const [dashboard, events] = await Promise.all([
        firstValueFrom(this.api.getDashboard()),
        firstValueFrom(this.api.listEvents({ page: 1, per_page: 25 })),
      ]);

      this.politeAnnouncement.set(
        `Polling update: ${dashboard.kpis.active_sessions} signed in, ${events.data.length} recent activities loaded.`
      );

      for (const row of events.data) {
        const telemetry: ApplicationAccessStreamTelemetry = {
          stream_id: `access:${row.id}`,
          stream_type: 'access',
          occurred_at: row.occurred_at,
          payload: {
            id: row.id,
            event_type: row.event_type,
            authorization_result: row.authorization_result,
            normalized_route: row.normalized_route,
          },
        };
        this.liveEvents.update((current) => pushLiveTelemetryEvent(current, telemetry, this.seenIds, MAX_BUFFER_SIZE));
      }
    } catch {
      // Keep polling silently on transient failures.
    }
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
