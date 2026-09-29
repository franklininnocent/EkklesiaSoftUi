export type ApplicationAccessStreamType = 'access' | 'security';

export interface ApplicationAccessStreamTelemetry {
  stream_id: string;
  stream_type: ApplicationAccessStreamType;
  occurred_at: string;
  payload: Record<string, unknown>;
}

export type ApplicationAccessStreamConnectionState =
  | 'stopped'
  | 'connecting'
  | 'live'
  | 'reconnecting'
  | 'polling';

export interface ParsedSseMessage {
  id?: string;
  event?: string;
  data?: string;
}
