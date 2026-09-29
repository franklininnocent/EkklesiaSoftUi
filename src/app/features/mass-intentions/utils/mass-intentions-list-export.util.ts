import { MassIntentionRecord } from '../services/mass-intentions-api.service';
import {
  formatMassIntentionScheduledDay,
  massIntentionBeneficiaryIdentification,
  massIntentionListDescription,
  massIntentionListType,
} from './mass-intention-list-display';
import { massIntentionStageLabel } from './mass-intention-status-display';

export interface MassIntentionsListFilterSummary {
  search?: string;
  status?: string;
  requestedDate?: string;
}

export function buildMassIntentionsExportFilename(filters: MassIntentionsListFilterSummary): string {
  const date = new Date().toISOString().slice(0, 10);
  const parts = ['mass-intentions', date];
  if (filters.status) {
    parts.push(filters.status);
  }
  if (filters.requestedDate) {
    parts.push(filters.requestedDate);
  }
  return `${parts.join('-')}.pdf`;
}

export function massIntentionsFilterSummaryLine(filters: MassIntentionsListFilterSummary): string {
  const parts: string[] = [];
  if (filters.status === 'open') {
    parts.push('Status: Open');
  } else if (filters.status === 'closed') {
    parts.push('Status: Closed');
  }
  if (filters.requestedDate) {
    parts.push(`Scheduled day: ${formatMassIntentionScheduledDay(filters.requestedDate)}`);
  }
  if (filters.search?.trim()) {
    parts.push(`Search: ${filters.search.trim()}`);
  }
  return parts.length ? parts.join(' · ') : 'All intentions (no filters)';
}

/** Opens a blank window synchronously (must run inside the user click handler). */
export function openMassIntentionsPrintWindow(): Window | null {
  const targetWindow = window.open('', '_blank', 'width=900,height=700');
  if (!targetWindow) {
    return null;
  }

  targetWindow.document.open();
  targetWindow.document.write(`
    <!DOCTYPE html>
    <html><head><title>Loading register…</title></head>
    <body style="font-family:system-ui,sans-serif;padding:2rem;color:#475569;">Loading register…</body></html>
  `);
  targetWindow.document.close();

  return targetWindow;
}

export function downloadMassIntentionsPdf(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function printMassIntentionsList(
  rows: MassIntentionRecord[],
  filters: MassIntentionsListFilterSummary,
  targetWindow: Window,
): void {
  const summary = massIntentionsFilterSummaryLine(filters);
  const escape = (value: string): string =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const bodyRows = rows
    .map((row) => {
      const description = massIntentionListDescription(row) ?? '—';
      const identification = massIntentionBeneficiaryIdentification(row);
      const forCell = identification
        ? `${escape(row.beneficiary_name ?? '')}<br /><span style="color:#64748b;font-size:10px;">${escape(identification)}</span>`
        : escape(row.beneficiary_name ?? '');
      return `<tr>
        <td>${escape(formatMassIntentionScheduledDay(row.requested_date))}</td>
        <td>${forCell}</td>
        <td>${escape(massIntentionListType(row))}</td>
        <td class="desc">${escape(description)}</td>
        <td>${escape(massIntentionStageLabel(row.status, row.said_progress))}</td>
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Mass intentions register</title>
  <style>
    body { font-family: system-ui, sans-serif; font-size: 12px; color: #0f172a; margin: 1rem; }
    h1 { font-size: 1.1rem; margin: 0 0 0.25rem; }
    p.meta { margin: 0 0 1rem; color: #64748b; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 0.35rem 0.5rem; text-align: left; vertical-align: top; }
    th { background: #f8fafc; font-size: 11px; }
    td.desc { max-width: 14rem; word-break: break-word; }
    @media print { body { margin: 0.5rem; } }
  </style>
</head>
<body>
  <h1>Mass intentions — office register</h1>
  <p class="meta">${escape(summary)} · ${rows.length} record${rows.length === 1 ? '' : 's'}</p>
  <table>
    <thead>
      <tr>
        <th>Scheduled day</th>
        <th>For</th>
        <th>Intention</th>
        <th>Description</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${bodyRows || '<tr><td colspan="5">No records match the current filters.</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;

  targetWindow.document.open();
  targetWindow.document.write(html);
  targetWindow.document.close();
  targetWindow.focus();
  targetWindow.onload = () => {
    targetWindow.print();
  };
}
