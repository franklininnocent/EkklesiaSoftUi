import { featuresForRoute, ROUTE_FEATURE_REQUIREMENTS } from './feature-requirements';

describe('feature-requirements', () => {
  it('maps Mass intentions screens to MASS_INTENTIONS', () => {
    expect(ROUTE_FEATURE_REQUIREMENTS['/mass-intentions']).toBe('MASS_INTENTIONS');
    expect(featuresForRoute('/mass-intentions')).toContain('MASS_INTENTIONS');
    expect(featuresForRoute('/mass-intentions/intentions/new')).toContain('MASS_INTENTIONS');
  });
});
