import { FinancialCommandCenterPayload } from '../../models/donation.model';
import { formatFocCurrency, lastSyncLabel } from './foc-format.util';

export type HubPriorityLevel = 'critical' | 'high' | 'medium' | 'low' | 'clear';
export type HubInsightTone = 'positive' | 'neutral' | 'warning' | 'critical';

export interface HubPriorityCard {
  id: string;
  title: string;
  metric: string;
  detail: string;
  actionLabel: string;
  route: string;
  level: HubPriorityLevel;
  expectedAmount?: string | null;
}

export interface HubWorkflowItem {
  label: string;
  description: string;
  route: string;
  kind?: 'emit' | 'route';
  target?: string;
}

export interface HubWorkflowGroup {
  id: string;
  title: string;
  description: string;
  icon: 'collections' | 'families' | 'projects';
  items: HubWorkflowItem[];
}

export interface HubInsightCard {
  id: string;
  message: string;
  tone: HubInsightTone;
  route: string;
}

export interface HubTimelineItem {
  id: string;
  action: string;
  record: string;
  actor: string;
  timeLabel: string;
  route: string;
  amount?: string | null;
  category: 'collection' | 'expense' | 'reminder' | 'project' | 'receipt';
}

export interface OperationsHubViewModel {
  syncLabel: string;
  churchName: string;
  openTasksCount: number;
  priorityStatusLabel: string;
  hasActivePriorities: boolean;
  priorities: HubPriorityCard[];
  workflowGroups: HubWorkflowGroup[];
  insights: HubInsightCard[];
  timeline: HubTimelineItem[];
  attentionCount: number;
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  clear: 4
};

const PRIORITY_META: Record<string, { title: string; action: string; level: HubPriorityLevel }> = {
  families_follow_up: { title: 'Overdue Collections', action: 'Review', level: 'critical' },
  outstanding_collections: { title: 'Collections Pending', action: 'View Queue', level: 'high' },
  project_funding_gaps: { title: 'Project Funding Gap', action: 'View Details', level: 'medium' },
  upcoming_collection_days: { title: 'Upcoming Collection Day', action: 'Prepare', level: 'medium' },
  missing_commitments: { title: 'Missing Commitments', action: 'Review Plans', level: 'medium' },
  giving_declines: { title: 'Giving Declines', action: 'View Donors', level: 'low' }
};

export function buildOperationsHubViewModel(
  data: FinancialCommandCenterPayload,
  currencyCode = 'INR'
): OperationsHubViewModel {
  const syncLabel = lastSyncLabel(data.meta?.last_synced_at);
  const churchName = data.meta?.church_name ?? 'Parish';
  const priorities = buildPriorities(data, currencyCode);
  const activePriorities = priorities.filter((card) => card.level !== 'clear' && card.level !== 'low');
  const hasActivePriorities = activePriorities.length > 0;
  const openTasksCount = (data.action_center ?? []).reduce((sum, queue) => {
    if (queue.affected_count > 0 && queue.priority !== 'low') {
      return sum + queue.affected_count;
    }
    return sum;
  }, 0);

  const attentionCount = activePriorities.length;

  return {
    syncLabel,
    churchName,
    openTasksCount,
    priorityStatusLabel: hasActivePriorities
      ? `${openTasksCount || attentionCount} active item${(openTasksCount || attentionCount) === 1 ? '' : 's'} require attention`
      : 'All systems operating normally',
    hasActivePriorities,
    priorities: hasActivePriorities ? activePriorities.slice(0, 4) : [buildHealthyPriorityCard(data)],
    workflowGroups: buildWorkflowGroups(data),
    insights: buildInsights(data, currencyCode),
    timeline: buildTimeline(data, currencyCode),
    attentionCount
  };
}

function buildHealthyPriorityCard(data: FinancialCommandCenterPayload): HubPriorityCard {
  const health = data.collection_health;
  return {
    id: 'collection-performance',
    title: 'Collection Performance',
    metric: 'On track this month',
    detail: health?.summary ?? 'No outstanding collections or operational issues require attention.',
    actionLabel: 'Open Analytics',
    route: '/donations/collection-health',
    level: 'clear'
  };
}

function buildPriorities(data: FinancialCommandCenterPayload, currencyCode: string): HubPriorityCard[] {
  const queues = [...(data.action_center ?? [])]
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9));

  const cards = queues.map((queue) => {
    const meta = PRIORITY_META[queue.key] ?? {
      title: queue.title,
      action: 'Review',
      level: queue.priority as HubPriorityLevel
    };
    const hasWork = queue.affected_count > 0 || queue.expected_amount > 0;
    const metric = queue.affected_count > 0
      ? `${queue.affected_count} ${queue.affected_count === 1 ? 'family' : 'families'} ${queue.key.includes('collection') ? 'pending' : 'affected'}`
      : hasWork ? 'Requires review' : 'All clear';

    return {
      id: queue.key,
      title: meta.title,
      metric,
      detail: queue.summary,
      actionLabel: hasWork ? meta.action : 'View Status',
      route: queue.cta_route,
      level: hasWork ? meta.level : 'clear',
      expectedAmount: queue.expected_amount > 0 ? formatFocCurrency(queue.expected_amount, currencyCode) : null
    };
  });

  const healthIssues = (data.collection_health?.issues ?? [])
    .filter((issue) => issue.severity !== 'normal')
    .map((issue, index) => ({
      id: `health-issue-${index}`,
      title: issue.severity === 'critical' ? 'Critical Collection Risk' : 'Collection Attention',
      metric: issue.message,
      detail: issue.detail ?? 'Review collection health indicators.',
      actionLabel: 'Investigate',
      route: issue.cta_route || '/donations/collection-health',
      level: (issue.severity === 'critical' ? 'critical' : 'high') as HubPriorityLevel,
      expectedAmount: null
    }));

  const merged = [...healthIssues, ...cards];
  return merged.filter((card, index, list) => list.findIndex((item) => item.id === card.id) === index);
}

function buildWorkflowGroups(data: FinancialCommandCenterPayload): HubWorkflowGroup[] {
  const followUp = data.action_center?.find((queue) => queue.key === 'families_follow_up')?.affected_count ?? 0;

  return [
    {
      id: 'collections',
      title: 'Collection Operations',
      description: 'Record payments, receipts, and collection day workflows',
      icon: 'collections',
      items: [
        { label: 'Collect Contribution', description: 'Record a payment now', route: '', kind: 'emit', target: 'collect' },
        { label: 'Issue Receipt', description: 'Print or send receipts', route: '/donations/receipts' },
        { label: 'Collection Day Mode', description: 'Live collection workspace', route: '/donations/collection-day' }
      ]
    },
    {
      id: 'families',
      title: 'Family Operations',
      description: 'Directory, follow-up queue, and financial profiles',
      icon: 'families',
      items: [
        { label: 'Family Directory', description: 'Browse parish families', route: '/families' },
        { label: 'Follow-Up Queue', description: followUp > 0 ? `${followUp} families need attention` : 'Review outstanding families', route: '/donations/dues' },
        { label: 'Financial 360', description: 'Donor and dues intelligence', route: '/donations/donors' }
      ]
    },
    {
      id: 'projects',
      title: 'Project Operations',
      description: 'Plans, funding projects, and installment tracking',
      icon: 'projects',
      items: [
        { label: 'Contribution Plans', description: 'Mandatory and voluntary plans', route: '/donations/plans' },
        { label: 'Funding Projects', description: 'Active parish initiatives', route: '/donations/projects' },
        { label: 'Installments', description: 'Project installment tracking', route: '/donations/project-installments' }
      ]
    }
  ];
}

function buildInsights(data: FinancialCommandCenterPayload, currencyCode: string): HubInsightCard[] {
  const insights: HubInsightCard[] = [];
  const followUp = data.action_center?.find((queue) => queue.key === 'families_follow_up');
  const declines = data.action_center?.find((queue) => queue.key === 'giving_declines');
  const projectGap = data.action_center?.find((queue) => queue.key === 'project_funding_gaps');
  const participation = data.analytics?.family_engagement?.participation_rate ?? 0;
  const trend = data.collection_health?.trend_pct;

  if (followUp && followUp.affected_count > 0) {
    insights.push({
      id: 'follow-up-insight',
      message: `${followUp.affected_count} families have outstanding contributions requiring follow-up.`,
      tone: 'warning',
      route: '/donations/dues'
    });
  }

  if (declines && declines.affected_count > 0) {
    insights.push({
      id: 'declines-insight',
      message: `${declines.affected_count} families have not contributed consistently in recent months.`,
      tone: 'warning',
      route: '/donations/donors'
    });
  }

  if (trend != null && trend !== 0) {
    insights.push({
      id: 'trend-insight',
      message: trend > 0
        ? `Collections increased ${Math.abs(trend)}% compared to the prior period.`
        : `Collections decreased ${Math.abs(trend)}% compared to the prior period.`,
      tone: trend > 0 ? 'positive' : 'warning',
      route: '/donations/reports'
    });
  }

  if (projectGap && projectGap.affected_count > 0) {
    insights.push({
      id: 'project-gap-insight',
      message: projectGap.expected_amount > 0
        ? `${projectGap.affected_count} project(s) may miss target by ${formatFocCurrency(projectGap.expected_amount, currencyCode)}.`
        : `${projectGap.affected_count} active project(s) are behind funding targets.`,
      tone: 'warning',
      route: '/donations/projects'
    });
  }

  const topBcc = data.analytics?.geographic?.by_bcc?.[0];
  if (topBcc && participation > 0) {
    insights.push({
      id: 'participation-insight',
      message: `Participation is ${Math.round(participation)}% parish-wide. ${topBcc.area_name} leads with ${formatFocCurrency(topBcc.collected, currencyCode)} collected.`,
      tone: participation >= 70 ? 'positive' : 'neutral',
      route: '/donations/reports'
    });
  }

  for (const item of (data.collection_health?.insights ?? []).slice(0, 2)) {
    insights.push({
      id: `health-${item}`,
      message: item,
      tone: 'neutral',
      route: '/donations/collection-health'
    });
  }

  for (const narrative of (data.ai_advisor?.narratives ?? []).slice(0, 1)) {
    insights.push({
      id: `ai-${narrative.slice(0, 24)}`,
      message: narrative,
      tone: 'neutral',
      route: '/donations/reports'
    });
  }

  const unique = insights.filter((item, index, list) => list.findIndex((entry) => entry.message === item.message) === index);
  return unique.slice(0, 5);
}

function buildTimeline(data: FinancialCommandCenterPayload, currencyCode: string): HubTimelineItem[] {
  const operator = data.meta?.operator_name ?? 'Parish Team';
  const items: HubTimelineItem[] = [];

  for (const contributor of (data.contribution_intelligence?.recent_contributors ?? []).slice(0, 3)) {
    items.push({
      id: `contrib-${contributor.family_id}`,
      action: 'Collection Recorded',
      record: contributor.family_name ?? contributor.family_code ?? 'Family contribution',
      actor: operator,
      timeLabel: formatRelativeDate(contributor.payment_date),
      route: '/donations/payments',
      amount: formatFocCurrency(contributor.amount, currencyCode),
      category: 'collection'
    });
  }

  for (const expense of (data.expense_summary?.recent ?? []).slice(0, 2)) {
    items.push({
      id: `expense-${expense.id}`,
      action: 'Expense Added',
      record: expense.category || 'Parish expense',
      actor: operator,
      timeLabel: formatRelativeDate(expense.expense_date),
      route: '/donations/expenses',
      amount: formatFocCurrency(expense.amount, currencyCode),
      category: 'expense'
    });
  }

  const sent = data.communication_center?.whatsapp_sent ?? 0;
  if (sent > 0) {
    items.push({
      id: 'reminder-sent',
      action: 'Reminder Sent',
      record: `${sent} outreach message${sent === 1 ? '' : 's'} delivered`,
      actor: operator,
      timeLabel: 'Today',
      route: '/donations/notifications',
      category: 'reminder'
    });
  }

  for (const project of (data.projects_command ?? []).slice(0, 2)) {
    items.push({
      id: `project-${project.project_id}`,
      action: 'Project Updated',
      record: `${project.name} · ${project.funding_percentage}% funded`,
      actor: operator,
      timeLabel: 'Active',
      route: '/donations/projects',
      category: 'project'
    });
  }

  if (items.length < 3) {
    items.push({
      id: 'receipt-hub',
      action: 'Receipt Generated',
      record: 'Receipts hub ready for printing',
      actor: operator,
      timeLabel: 'Available',
      route: '/donations/receipts',
      category: 'receipt'
    });
  }

  return items.slice(0, 6);
}

function formatRelativeDate(raw?: string | null): string {
  if (!raw) {
    return 'Recently';
  }
  try {
    const date = new Date(raw);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) {
      return 'Just now';
    }
    if (diffMins < 60) {
      return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    }
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) {
      return 'Yesterday';
    }
    if (diffDays < 7) {
      return `${diffDays} days ago`;
    }
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
  } catch {
    return 'Recently';
  }
}
