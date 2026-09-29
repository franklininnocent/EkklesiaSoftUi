import {
  donationReportExportFormatLabel,
  donationReportExportFormatShortLabel,
  resolveDonationReportExportFormat,
} from './donation-report-export-format.util';

describe('donation report export format utils', () => {
  it('maps known formats', () => {
    expect(donationReportExportFormatLabel('csv')).toBe('CSV');
    expect(donationReportExportFormatLabel('xlsx')).toBe('Excel (.xlsx)');
    expect(donationReportExportFormatLabel('pdf')).toBe('PDF');
    expect(donationReportExportFormatShortLabel('xlsx')).toBe('Excel');
  });

  it('defaults missing format to CSV', () => {
    expect(resolveDonationReportExportFormat({})).toBe('csv');
  });

  it('reads format from filters or file path', () => {
    expect(
      resolveDonationReportExportFormat({
        filters: { export_format: 'pdf' },
      }),
    ).toBe('pdf');
    expect(
      resolveDonationReportExportFormat({
        file_path: 'reports/sample.xlsx',
      }),
    ).toBe('xlsx');
  });
});
