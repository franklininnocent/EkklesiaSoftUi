import { AuthService } from '@core/services/auth.service';

/** Mirrors API `EnsureTenantPermission` / `AuthorizesTenantPermission` for Mass Intentions actions. */
export function canCreateMassIntention(auth: AuthService): boolean {
  return auth.hasTenantPermission('mass.intentions.create');
}

export function canCloseMassIntention(auth: AuthService): boolean {
  return auth.hasTenantPermission('mass.intentions.review');
}

export function canConfigureMassIntentions(auth: AuthService): boolean {
  return auth.hasTenantPermission('mass.intentions.configure');
}

export function canExportMassRegister(auth: AuthService): boolean {
  return auth.hasTenantPermission('mass.intentions.register.export');
}

export function canScheduleMasses(auth: AuthService): boolean {
  return auth.hasTenantPermission('mass.intentions.schedule');
}

export function canFulfilMasses(auth: AuthService): boolean {
  return auth.hasTenantPermission('mass.intentions.fulfil');
}

export function canViewMassOfferings(auth: AuthService): boolean {
  return auth.hasTenantPermission('mass.intentions.offerings.view');
}
