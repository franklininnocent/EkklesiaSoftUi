/**
 * Pope Settings route wrapper — delegates to shared Pope Details Management UI.
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { PopeDetailsManagementComponent } from '../ecclesiastical/pope-details/pope-details-management.component';

@Component({
  selector: 'app-pope-settings',
  standalone: true,
  imports: [PopeDetailsManagementComponent],
  template: `<app-pope-details-management></app-pope-details-management>`,
  changeDetection: ChangeDetectionStrategy.Default,
})
export class PopeSettingsComponent {}
