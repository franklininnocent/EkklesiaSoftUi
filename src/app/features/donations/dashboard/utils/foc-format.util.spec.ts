import { formatExecutiveCardValue, healthGaugeArc, isFocLayerVisible, sparklinePoints } from './foc-format.util';

describe('foc-format.util', () => {
  it('formats executive card values', () => {
    expect(formatExecutiveCardValue({ key: 'participation', value: 55 }, 'INR')).toBe('55%');
    expect(formatExecutiveCardValue({ key: 'month_collected', value: 1000 }, 'INR')).toContain('1,000');
  });

  it('builds health gauge arc and sparkline', () => {
    expect(healthGaugeArc(50)).toContain(' ');
    expect(sparklinePoints(100).split(' ').length).toBeGreaterThan(2);
  });

  it('resolves layer aliases for persona sections', () => {
    expect(isFocLayerVisible(['layer_2_health'], 'health_overview')).toBe(true);
    expect(isFocLayerVisible(['layer_3_actions'], 'action_center')).toBe(true);
    expect(isFocLayerVisible(['layer_2_health'], 'analytics')).toBe(false);
  });
});
