import { orderMassCelebrationsForList } from './mass-celebration-list-order.util';
import { MassCelebrationSummary } from '../services/mass-intentions-api.service';

function row(id: string, on: string, at: string): MassCelebrationSummary {
  return { id, celebrated_on: on, celebrated_at: at, status: 'scheduled' };
}

describe('orderMassCelebrationsForList', () => {
  const tz = 'Asia/Kolkata';
  const now = '2026-09-29T16:00:00+05:30';

  it('lists upcoming ascending then past descending', () => {
    const items = [
      row('past-morning', '2026-09-29', '06:15'),
      row('next', '2026-09-29', '18:15'),
      row('later', '2026-09-30', '06:15'),
      row('old', '2026-09-28', '06:15'),
    ];

    const ordered = orderMassCelebrationsForList(items, now, tz, 'next').map((r) => r.id);
    expect(ordered).toEqual(['next', 'later', 'past-morning', 'old']);
  });

  it('pins next Mass when it is not already first upcoming', () => {
    const items = [
      row('later', '2026-09-30', '06:15'),
      row('next', '2026-09-29', '18:15'),
    ];
    const ordered = orderMassCelebrationsForList(items, now, tz, 'next').map((r) => r.id);
    expect(ordered[0]).toBe('next');
  });
});
