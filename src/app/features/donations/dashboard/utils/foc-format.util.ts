export function formatFocCurrency(value: number | null | undefined, currencyCode: string): string {
  const amount = Number(value ?? 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}

export function formatExecutiveCardValue(card: { key: string; value: number }, currencyCode: string): string {
  if (['participation', 'efficiency', 'projects', 'expense_ratio'].includes(card.key)) {
    return `${card.value}%`;
  }
  if (['month_collected', 'year_collected', 'outstanding', 'net_position'].includes(card.key)) {
    return formatFocCurrency(card.value, currencyCode);
  }
  return String(card.value);
}

export function sparklinePoints(value: number): string {
  const base = Math.max(value * 0.6, 1);
  const points = [base, base * 0.8, base * 1.1, base * 0.95, base * 1.2, value];
  const max = Math.max(...points, 1);
  return points.map((v, i) => {
    const x = i * (80 / (points.length - 1));
    const y = 22 - (v / max) * 18;
    return `${x},${y}`;
  }).join(' ');
}

export function barHeightPercent(value: number, maxTrendValue: number): number {
  return Math.max(8, (value / Math.max(maxTrendValue, 1)) * 100);
}

export function healthGaugeArc(score: number): string {
  const circumference = Math.PI * 48;
  const filled = (Math.min(100, Math.max(0, score)) / 100) * circumference;
  return `${filled} ${circumference}`;
}

export function lastSyncLabel(raw?: string | null): string {
  if (!raw) {
    return 'just now';
  }
  try {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(raw));
  } catch {
    return 'just now';
  }
}

export const FOC_LAYER_ALIASES: Record<string, string[]> = {
  command_bar: ['command_bar', 'layer_1_command'],
  health_overview: ['health_overview', 'layer_2_health'],
  action_center: ['action_center', 'layer_3_actions'],
  analytics: ['analytics', 'layer_4_analytics'],
  operational_intelligence: ['operational_intelligence', 'layer_5_intelligence'],
  diocese_rollup: ['diocese_rollup'],
  collections_command: ['collections_command'],
  ai_advisor: ['ai_advisor'],
  contribution_intelligence: ['contribution_intelligence'],
  communication_center: ['communication_center'],
  projects_command: ['projects_command']
};

export function isFocLayerVisible(sections: string[] | undefined, layer: string): boolean {
  if (!sections?.length) {
    return true;
  }
  const keys = FOC_LAYER_ALIASES[layer] ?? [layer];
  return keys.some((key) => sections.includes(key));
}
