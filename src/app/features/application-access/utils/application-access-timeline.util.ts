import { ApplicationAccessEvent } from '../models/application-access.model';

export interface TimelineAccessSummary {
  allowed: number;
  blocked: number;
  modules: string[];
}

export function summarizeTimelineEvents(events: ApplicationAccessEvent[]): TimelineAccessSummary {
  let allowed = 0;
  let blocked = 0;
  const modules = new Set<string>();

  for (const event of events) {
    if (event.authorization_result === 'denied') {
      blocked++;
    } else if (event.authorization_result === 'allowed') {
      allowed++;
    }

    const moduleCode = event.module_code;
    if (moduleCode) {
      modules.add(moduleCode);
    }
  }

  return {
    allowed,
    blocked,
    modules: [...modules].sort(),
  };
}
