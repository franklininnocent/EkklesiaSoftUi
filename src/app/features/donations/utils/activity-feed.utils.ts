export type ActivityFeedCategory =
  | 'all'
  | 'payments'
  | 'families'
  | 'projects'
  | 'plans'
  | 'settings'
  | 'donors'
  | 'categories'
  | 'offerings'
  | 'recurring'
  | 'reports';

export type ActivityTimeFilter = 'all' | 'today' | 'week';
export type TimelineDensity = 'compact' | 'comfortable';

export interface ParishActivityItem {
  id: number;
  created_at: string;
  category: string;
  icon: string;
  title: string;
  description: string;
  actor_name: string;
  subject_name?: string | null;
  amount?: number | null;
  currency?: string | null;
  action_label?: string | null;
  action_path?: string | null;
  requires_attention?: boolean;
}

export interface ActivityFeedGroup {
  label: string;
  items: ParishActivityItem[];
}

export interface ActivityQuickFilter {
  id: ActivityFeedCategory | ActivityTimeFilter;
  label: string;
  type: 'category' | 'time';
}

const ICONS: Record<string, string> = {
  donor: '🧑',
  category: '📋',
  plan: '📅',
  fund: '🏗',
  settings: '⚙',
  offering: '🎁',
  payment: '💰',
  project: '🏗',
  recurring: '🔁',
  report: '📊',
  receipt: '📄',
  family: '👨',
  activity: '•'
};

const GROUP_ORDER = ['Today', 'Yesterday', 'Earlier This Week', 'Last Week', 'Earlier'] as const;

export function activityIcon(icon: string, category?: string): string {
  if (category === 'families') {
    return ICONS['family'];
  }
  return ICONS[icon] || ICONS['activity'];
}

export function formatExactTimestamp(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  });
}

export function formatTimelineClock(isoDate: string, groupLabel: string, now = new Date()): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const clock = formatClock(date);

  if (groupLabel === 'Today') {
    return clock;
  }

  if (groupLabel === 'Yesterday') {
    return `Yesterday • ${clock}`;
  }

  if (groupLabel === 'Earlier This Week' || groupLabel === 'Last Week') {
    return `${weekdayLabel(date)} • ${clock}`;
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function buildCompactSummary(item: ParishActivityItem): string {
  const subject = item.subject_name || extractSubjectFromDescription(item.description);
  const actor = normalizeActor(item.actor_name);

  if (subject && actor) {
    return `${subject} • ${actor}`;
  }
  if (subject) {
    return subject;
  }
  if (actor) {
    return actor;
  }
  return shortenText(item.description, 72);
}

export function groupActivitiesByPeriod(items: ParishActivityItem[], now = new Date()): ActivityFeedGroup[] {
  const buckets: Record<string, ParishActivityItem[]> = {
    Today: [],
    Yesterday: [],
    'Earlier This Week': [],
    'Last Week': [],
    Earlier: []
  };

  const startOfThisWeek = startOfWeekDate(now);
  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  for (const item of items) {
    const date = new Date(item.created_at);
    if (Number.isNaN(date.getTime())) {
      buckets['Earlier'].push(item);
      continue;
    }

    if (isSameDay(date, now)) {
      buckets['Today'].push(item);
      continue;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (isSameDay(date, yesterday)) {
      buckets['Yesterday'].push(item);
      continue;
    }

    if (date >= startOfThisWeek) {
      buckets['Earlier This Week'].push(item);
      continue;
    }

    if (date >= startOfLastWeek) {
      buckets['Last Week'].push(item);
      continue;
    }

    buckets['Earlier'].push(item);
  }

  return GROUP_ORDER
    .filter((label) => buckets[label].length > 0)
    .map((label) => ({ label, items: buckets[label] }));
}

export function filterActivitiesByTime(items: ParishActivityItem[], timeFilter: ActivityTimeFilter, now = new Date()): ParishActivityItem[] {
  if (timeFilter === 'all') {
    return items;
  }

  if (timeFilter === 'today') {
    return items.filter((item) => isSameDay(new Date(item.created_at), now));
  }

  const startOfWeek = startOfWeekDate(now);
  return items.filter((item) => new Date(item.created_at) >= startOfWeek);
}

export function extractSubjectFromDescription(description: string): string | null {
  const patterns = [
    /^(.+?) was added as a donor\.?$/i,
    /^(.+?) was created\.?$/i,
    /^(.+?) category was (?:created|updated|removed)\.?$/i,
    /^(.+?) project was (?:created|updated)\.?$/i,
    /^(.+?) offering was recorded/i,
    /^(.+?) offering details were updated\.?$/i,
    /^(.+?) donor details were updated\.?$/i,
    /^(.+?) was updated\.?$/i,
    /^Installment schedule was generated for (.+?)\.?$/i
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function normalizeActor(actor: string): string {
  return actor === 'Parish team member' ? '' : actor;
}

function shortenText(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function startOfWeekDate(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? 6 : day - 1;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - diff);
  return copy;
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function weekdayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'long' });
}

export const ACTIVITY_FILTER_OPTIONS: Array<{ value: ActivityFeedCategory; label: string }> = [
  { value: 'all', label: 'All activities' },
  { value: 'payments', label: 'Payments' },
  { value: 'offerings', label: 'Donations' },
  { value: 'donors', label: 'Donors' },
  { value: 'projects', label: 'Projects' },
  { value: 'plans', label: 'Plans' },
  { value: 'categories', label: 'Categories' },
  { value: 'settings', label: 'Settings' },
  { value: 'recurring', label: 'Recurring' },
  { value: 'reports', label: 'Reports' }
];

export const ACTIVITY_QUICK_FILTERS: ActivityQuickFilter[] = [
  { id: 'all', label: 'All', type: 'category' },
  { id: 'today', label: 'Today', type: 'time' },
  { id: 'week', label: 'This Week', type: 'time' },
  { id: 'payments', label: 'Payments', type: 'category' },
  { id: 'plans', label: 'Plans', type: 'category' },
  { id: 'donors', label: 'Donors', type: 'category' },
  { id: 'categories', label: 'Categories', type: 'category' },
  { id: 'settings', label: 'Settings', type: 'category' }
];
