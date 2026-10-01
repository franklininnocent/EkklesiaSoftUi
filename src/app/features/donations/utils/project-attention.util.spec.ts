import { DonationProject } from '../models/donation.model';
import { projectNeedsAttention } from './project-attention.util';

function project(overrides: Partial<DonationProject> = {}): DonationProject {
  return {
    id: '1',
    name: 'Test',
    code: 'T',
    assignment_mode: 'uniform',
    target_amount: 10000,
    default_family_target: 5000,
    raised_amount: 0,
    status: 'active',
    ...overrides,
  };
}

describe('projectNeedsAttention', () => {
  it('uses API needs_attention when provided', () => {
    expect(projectNeedsAttention(project({ needs_attention: false, collection_percentage: 0 }))).toBe(false);
    expect(projectNeedsAttention(project({ needs_attention: true, collection_percentage: 80 }))).toBe(true);
  });

  it('flags active projects below 50% of funding target', () => {
    expect(
      projectNeedsAttention(
        project({ has_funding_target: true, collection_percentage: 49, needs_attention: undefined })
      )
    ).toBe(true);
    expect(
      projectNeedsAttention(
        project({ has_funding_target: true, collection_percentage: 50, needs_attention: undefined })
      )
    ).toBe(false);
  });

  it('does not flag projects without a measurable funding target', () => {
    expect(
      projectNeedsAttention(
        project({
          has_funding_target: false,
          collection_percentage: null,
          needs_attention: undefined,
        })
      )
    ).toBe(false);
  });

  it('ignores non-active projects', () => {
    expect(
      projectNeedsAttention(
        project({ status: 'draft', collection_percentage: 0, needs_attention: undefined })
      )
    ).toBe(false);
  });
});
