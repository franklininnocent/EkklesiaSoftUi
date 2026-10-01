import { CanDeactivateFn } from '@angular/router';
import { MassRegularSchedulePageComponent } from '../pages/mass-regular-schedule.page';

export const massScheduleCanDeactivateGuard: CanDeactivateFn<MassRegularSchedulePageComponent> = (component) =>
  component.confirmLeaveIfDirty();
