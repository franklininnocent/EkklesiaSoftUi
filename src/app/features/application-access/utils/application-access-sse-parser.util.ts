import { ParsedSseMessage } from '../models/application-access-stream.model';

export interface SseParseResult {
  messages: ParsedSseMessage[];
  remainder: string;
}

export function parseSseBuffer(buffer: string): SseParseResult {
  const messages: ParsedSseMessage[] = [];
  const parts = buffer.split('\n\n');
  const remainder = parts.pop() ?? '';

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed.startsWith(':')) {
      continue;
    }

    const message: ParsedSseMessage = {};
    const lines = trimmed.split('\n');

    for (const line of lines) {
      if (line.startsWith(':')) {
        continue;
      }

      const separatorIndex = line.indexOf(':');
      const field = separatorIndex === -1 ? line : line.slice(0, separatorIndex);
      const value = separatorIndex === -1 ? '' : line.slice(separatorIndex + 1).trimStart();

      switch (field) {
        case 'id':
          message.id = value;
          break;
        case 'event':
          message.event = value;
          break;
        case 'data':
          message.data = message.data ? `${message.data}\n${value}` : value;
          break;
        default:
          break;
      }
    }

    if (message.event || message.data || message.id) {
      messages.push(message);
    }
  }

  return { messages, remainder };
}
