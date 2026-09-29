import {
  formatEcclesiasticalAuditChanges,
  parseAuditPayload,
} from './ecclesiastical-audit.util';

describe('ecclesiastical-audit.util', () => {
  it('parses double-encoded audit JSON strings', () => {
    const payload = JSON.stringify(JSON.stringify({ full_name: 'Albert Anasthas' }));
    expect(parseAuditPayload(payload)).toEqual({ full_name: 'Albert Anasthas' });
  });

  it('formats create entries as readable field lines', () => {
    const lines = formatEcclesiasticalAuditChanges({
      action: 'create',
      new_values: {
        full_name: 'Most Rev. Dr. Albert Anasthas',
        email: 'bishop@example.com',
        id: 20,
        normalized_name: 'dr albert anasthas',
        created_at: '2026-09-09 16:00:37',
      },
    });

    expect(lines).toEqual([
      { label: 'Full name', text: 'Most Rev. Dr. Albert Anasthas' },
      { label: 'Email', text: 'bishop@example.com' },
    ]);
  });

  it('formats update entries with old and new values', () => {
    const lines = formatEcclesiasticalAuditChanges({
      action: 'update',
      changes: {
        email: { old: 'old@example.com', new: 'new@example.com' },
      },
    });

    expect(lines).toEqual([
      { label: 'Email', text: 'old@example.com → new@example.com' },
    ]);
  });

  it('formats create entries stored as JSON strings', () => {
    const lines = formatEcclesiasticalAuditChanges({
      action: 'create',
      new_values: JSON.stringify({
        full_name: 'Most Rev. Dr. Albert Anasthas',
        status: 'active',
      }),
    });

    expect(lines).toEqual([
      { label: 'Full name', text: 'Most Rev. Dr. Albert Anasthas' },
      { label: 'Status', text: 'Active' },
    ]);
  });
});
