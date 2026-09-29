import { ApplicationAccessStreamTelemetry } from '../models/application-access-stream.model';

export function pushLiveTelemetryEvent(
  events: ApplicationAccessStreamTelemetry[],
  event: ApplicationAccessStreamTelemetry,
  seenIds: Set<string>,
  maxSize = 100
): ApplicationAccessStreamTelemetry[] {
  if (seenIds.has(event.stream_id)) {
    return events;
  }

  seenIds.add(event.stream_id);
  const next = [event, ...events];
  return next.length > maxSize ? next.slice(0, maxSize) : next;
}
