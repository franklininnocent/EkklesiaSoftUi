export function formatReportDrillDownMethodology(
  methodology: Record<string, unknown> | null | undefined,
  pointKind?: string
): string[] {
  if (!methodology || typeof methodology !== 'object') {
    return [];
  }

  const lines: string[] = [];

  if (typeof methodology['note'] === 'string') {
    lines.push(String(methodology['note']));
  }
  if (typeof methodology['formula'] === 'string') {
    lines.push(String(methodology['formula']));
  }
  if (typeof methodology['aggregation'] === 'string') {
    lines.push(String(methodology['aggregation']));
  }

  for (const snapshotKey of ['expected_window', 'collected', 'outstanding'] as const) {
    const value = methodology[snapshotKey];
    if (typeof value === 'string' && value.length > 0) {
      lines.push(`${humanizeKey(snapshotKey)}: ${value}`);
    }
  }

  const weights = methodology['weights'];
  if (weights && typeof weights === 'object') {
    lines.push('Score weights:');
    for (const [key, pct] of Object.entries(weights as Record<string, unknown>)) {
      lines.push(`  · ${humanizeKey(key)}: ${pct}%`);
    }
  }

  const factors = methodology['factors'];
  if (factors && typeof factors === 'object') {
    lines.push('Factor inputs (0–100):');
    for (const [key, value] of Object.entries(factors as Record<string, unknown>)) {
      lines.push(`  · ${humanizeKey(key)}: ${value}`);
    }
  }

  const inputs = methodology['inputs'];
  if (inputs && typeof inputs === 'object') {
    lines.push('Inputs:');
    for (const [key, value] of Object.entries(inputs as Record<string, unknown>)) {
      lines.push(`  · ${humanizeKey(key)}: ${value}`);
    }
  }

  if (methodology['collection_growth_pct'] != null) {
    lines.push(`Collection growth: ${methodology['collection_growth_pct']}%`);
  }

  if (pointKind === 'forecast' && lines.length === 0) {
    lines.push('Month-end projection uses daily pace × days in month (see forecast narrative).');
  }

  return lines;
}

function humanizeKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
