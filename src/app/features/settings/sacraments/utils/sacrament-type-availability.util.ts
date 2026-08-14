import { SacramentType } from '../models/sacrament.model';

/** Tenant Sacrament Settings: missing flag defaults to available (same as API). */
export function isSacramentTypeEnabledForTenant(
  type: Pick<SacramentType, 'enabled_for_tenant'>
): boolean {
  return type.enabled_for_tenant !== false;
}

/**
 * Types shown on Add/Edit Sacrament. Inactive church types are omitted,
 * except the record's current type so historical rows stay editable.
 */
export function sacramentTypesForSelector(
  types: SacramentType[],
  options: { includeTypeId?: number | null } = {}
): SacramentType[] {
  const includeTypeId = options.includeTypeId ?? null;
  return types.filter(
    (type) => isSacramentTypeEnabledForTenant(type) || type.id === includeTypeId
  );
}
