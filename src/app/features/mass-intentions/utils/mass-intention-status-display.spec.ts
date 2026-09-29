import { massIntentionStageLabel, massIntentionWorkflowBanner } from './mass-intention-status-display';

describe('mass-intention-status-display', () => {
  it('labels open and closed', () => {
    expect(massIntentionStageLabel('open')).toBe('Open');
    expect(massIntentionStageLabel('closed')).toBe('Closed');
  });

  it('explains open workflow on form', () => {
    expect(massIntentionWorkflowBanner('open')?.title).toBe('Open');
  });
});
