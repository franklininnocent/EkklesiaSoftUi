import { ApplicationAccessStreamTelemetry } from '../models/application-access-stream.model';

export function liveTelemetryLabel(event: ApplicationAccessStreamTelemetry): string {
  const payload = event.payload ?? {};

  if (event.stream_type === 'security') {
    const eventType = String(payload['event_type'] ?? 'Security event');
    const reason = payload['reason_code'] ? ` (${payload['reason_code']})` : '';
    return `${eventType}${reason}`;
  }

  const eventType = String(payload['event_type'] ?? 'Activity');
  const route = String(payload['normalized_route'] ?? '');
  return route ? `${eventType} · ${route}` : eventType;
}

export function isHighRiskTelemetry(event: ApplicationAccessStreamTelemetry): boolean {
  if (event.stream_type === 'security') {
    const severity = String(event.payload['severity'] ?? '').toUpperCase();
    return severity === 'HIGH' || severity === 'CRITICAL';
  }

  return event.payload['authorization_result'] === 'denied';
}
