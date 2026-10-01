import { sacramentMasonryRowSpan } from './sacrament-masonry.util';

describe('sacramentMasonryRowSpan', () => {
  it('gives a taller card a larger span than a shorter card', () => {
    const baptism = sacramentMasonryRowSpan(280, 10, 1);
    const eucharist = sacramentMasonryRowSpan(90, 10, 1);

    expect(baptism).toBe(290);
    expect(eucharist).toBe(100);
    expect(baptism).toBeGreaterThan(eucharist);
  });

  it('includes the bottom margin so the next card clears the gap', () => {
    expect(sacramentMasonryRowSpan(120, 10, 1)).toBe(130);
    expect(sacramentMasonryRowSpan(120, 0, 1)).toBe(120);
  });

  it('rounds fractional content up to the next track', () => {
    expect(sacramentMasonryRowSpan(100.2, 10, 1)).toBe(111);
  });

  it('keeps a single track when the card has not been measured yet', () => {
    expect(sacramentMasonryRowSpan(0, 0, 1)).toBe(1);
    expect(sacramentMasonryRowSpan(-4, 10, 1)).toBe(10);
  });

  it('falls back to a 1px track when the row size is missing', () => {
    expect(sacramentMasonryRowSpan(40, 10, 0)).toBe(50);
    expect(sacramentMasonryRowSpan(40, 10, Number.NaN)).toBe(50);
  });
});
