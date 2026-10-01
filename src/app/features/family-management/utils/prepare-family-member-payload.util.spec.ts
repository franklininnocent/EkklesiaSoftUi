import {
  isMarriageDateConflictError,
  prepareFamilyMemberPayload
} from './prepare-family-member-payload.util';
import { FamilyMemberFormValue } from '../components/family-member-form-modal/family-member-form-modal.component';

function baseValue(overrides: Partial<FamilyMemberFormValue> = {}): FamilyMemberFormValue {
  return {
    first_name: 'Jane',
    last_name: 'Doe',
    relationship_to_head: 'self',
    marital_status: 'married',
    marriage_date: '2010-06-20',
    status: 'active',
    ...overrides,
  };
}

describe('prepareFamilyMemberPayload marriage date', () => {
  it('includes marriage_date when marital status is married', () => {
    const payload = prepareFamilyMemberPayload(baseValue(), '+1');
    expect(payload['marriage_date']).toBe('2010-06-20');
  });

  it('omits marriage_date when marital status is not married', () => {
    const payload = prepareFamilyMemberPayload(baseValue({
      marital_status: 'widowed',
      marriage_date: '2010-06-20',
    }), '+1');
    expect(payload).not.toHaveProperty('marriage_date');
  });

  it('includes acknowledgement flag only when true', () => {
    expect(prepareFamilyMemberPayload(baseValue(), '+1')).not.toHaveProperty('acknowledge_marriage_date_conflict');
    const payload = prepareFamilyMemberPayload(baseValue({
      acknowledge_marriage_date_conflict: true,
    }), '+1');
    expect(payload['acknowledge_marriage_date_conflict']).toBe(true);
  });
});

describe('isMarriageDateConflictError', () => {
  it('detects the conflict code in validation errors', () => {
    expect(isMarriageDateConflictError({
      error: {
        errors: {
          marriage_date: ['This date is different on the linked spouse'],
          conflict: ['marriage_date_conflict'],
        }
      }
    })).toBe(true);
  });

  it('returns false for other validation errors', () => {
    expect(isMarriageDateConflictError({
      error: { errors: { marriage_date: ['The marriage date must be a date before or equal to today.'] } }
    })).toBe(false);
    expect(isMarriageDateConflictError(null)).toBe(false);
  });
});
