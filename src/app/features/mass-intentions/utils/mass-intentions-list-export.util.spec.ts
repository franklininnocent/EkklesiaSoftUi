import {
  buildMassIntentionsExportFilename,
  massIntentionsFilterSummaryLine,
} from './mass-intentions-list-export.util';

describe('mass-intentions-list-export.util', () => {
  it('builds filename with filter hints', () => {
    expect(buildMassIntentionsExportFilename({ status: 'open', requestedDate: '2026-10-01' })).toMatch(
      /^mass-intentions-\d{4}-\d{2}-\d{2}-open-2026-10-01\.pdf$/,
    );
  });

  it('summarizes active filters', () => {
    const line = massIntentionsFilterSummaryLine({
      status: 'open',
      requestedDate: '2026-10-01',
      search: 'Jane',
    });
    expect(line).toContain('Open');
    expect(line).toContain('Oct');
    expect(line).toContain('Jane');
  });
});
