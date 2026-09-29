import { DonationReportExport, DonationReportExportFormat } from '../../models/donation.model';

export function resolveDonationReportExportFormat(
  report: Pick<DonationReportExport, 'export_format' | 'file_path'> & {
    filters?: Record<string, unknown> | null;
  },
): DonationReportExportFormat {
  const fromFilters = report.filters?.['export_format'];
  if (fromFilters === 'csv' || fromFilters === 'xlsx' || fromFilters === 'pdf') {
    return fromFilters;
  }

  const direct = report.export_format;
  if (direct === 'csv' || direct === 'xlsx' || direct === 'pdf') {
    return direct;
  }

  const path = (report.file_path ?? '').toLowerCase();
  if (path.endsWith('.xlsx')) {
    return 'xlsx';
  }
  if (path.endsWith('.pdf')) {
    return 'pdf';
  }

  return 'csv';
}

export function donationReportExportFormatLabel(
  format?: DonationReportExportFormat | string | null,
): string {
  switch (format) {
    case 'xlsx':
      return 'Excel (.xlsx)';
    case 'pdf':
      return 'PDF';
    case 'csv':
    default:
      return 'CSV';
  }
}

export function donationReportExportFormatShortLabel(
  format?: DonationReportExportFormat | string | null,
): string {
  switch (format) {
    case 'xlsx':
      return 'Excel';
    case 'pdf':
      return 'PDF';
    case 'csv':
    default:
      return 'CSV';
  }
}

export function donationReportExportFormatLabelForRow(report: DonationReportExport): string {
  return donationReportExportFormatLabel(resolveDonationReportExportFormat(report));
}

export function donationReportExportFormatShortLabelForRow(report: DonationReportExport): string {
  return donationReportExportFormatShortLabel(resolveDonationReportExportFormat(report));
}
