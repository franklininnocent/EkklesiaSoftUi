import {
  isSacramentTypeEnabledForTenant,
  sacramentTypesForSelector,
} from './sacrament-type-availability.util';
import { SacramentType } from '../models/sacrament.model';

function type(partial: Partial<SacramentType> & Pick<SacramentType, 'id' | 'name' | 'code'>): SacramentType {
  return {
    category: 'initiation',
    display_order: 1,
    repeatable: false,
    requires_minister: false,
    active: true,
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

describe('sacramentTypesForSelector', () => {
  const baptism = type({ id: 1, name: 'Baptism', code: 'BAPTISM', enabled_for_tenant: true });
  const marriage = type({ id: 3, name: 'Marriage', code: 'MARRIAGE', enabled_for_tenant: false });
  const confirmation = type({ id: 2, name: 'Confirmation', code: 'CONFIRMATION' });

  it('keeps types that are active for the church', () => {
    expect(sacramentTypesForSelector([baptism, marriage]).map((row) => row.id)).toEqual([1]);
  });

  it('treats a missing enabled_for_tenant flag as active', () => {
    expect(isSacramentTypeEnabledForTenant(confirmation)).toBe(true);
    expect(sacramentTypesForSelector([confirmation]).map((row) => row.id)).toEqual([2]);
  });

  it('includes an inactive type only when it is the current historical record', () => {
    expect(
      sacramentTypesForSelector([baptism, marriage], { includeTypeId: 3 }).map((row) => row.id)
    ).toEqual([1, 3]);
  });
});
