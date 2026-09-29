import { formatReportDrillDownMethodology } from './report-drill-down-methodology.util';

describe('formatReportDrillDownMethodology', () => {
  it('formats formula and weights', () => {
    const lines = formatReportDrillDownMethodology({
      formula: '50 + (collection_growth_pct / 2)',
      weights: { family_engagement: 35, overdue_health: 30 }
    });
    expect(lines.some((l) => l.includes('50 +'))).toBe(true);
    expect(lines.some((l) => l.includes('Score weights'))).toBe(true);
  });
});
