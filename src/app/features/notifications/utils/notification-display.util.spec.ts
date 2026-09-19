import {
  isActionRequired,
  notificationCategoryLabel,
  notificationDefinitionLabel,
  notificationModuleInitial,
  notificationPriorityTone,
} from './notification-display.util';
import { UserNotification } from '../models/notification.model';

describe('notification-display.util', () => {
  it('maps known definition codes to readable labels', () => {
    expect(notificationDefinitionLabel('donations.refund.requested')).toBe('Refund approval needed');
    expect(notificationDefinitionLabel('unknown.code.here')).toBe('unknown · code · here');
  });

  it('maps categories and module initials', () => {
    expect(notificationCategoryLabel('system')).toBe('System & security');
    expect(notificationModuleInitial('Donations')).toBe('D');
    expect(notificationModuleInitial(null)).toBe('N');
  });

  it('derives priority tone and action-required state', () => {
    expect(notificationPriorityTone('critical')).toBe('critical');
    expect(notificationPriorityTone('high')).toBe('warning');
    expect(notificationPriorityTone('normal')).toBe('neutral');

    const item = { action_status: 'required' } as UserNotification;
    expect(isActionRequired(item)).toBe(true);
  });
});
