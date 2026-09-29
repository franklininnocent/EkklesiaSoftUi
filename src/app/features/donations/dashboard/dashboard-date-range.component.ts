import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';

export type DashboardPeriodPreset = 'this_month' | 'this_fy' | 'last_90' | 'ytd' | 'custom';

export interface DashboardDateRangeValue {
  preset: DashboardPeriodPreset;
  date_from?: string;
  date_to?: string;
  bcc_id?: string | null;
  project_id?: string | null;
  /** Client-only label for filter chips; not sent to the API. */
  project_name?: string | null;
}

@Component({
  selector: 'app-dashboard-date-range',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dash-range" role="group" [attr.aria-label]="'Reporting period'">
      <div class="dash-range__presets" role="tablist" aria-label="Period shortcuts">
        <button
          type="button"
          *ngFor="let option of presets"
          class="dash-range__preset"
          role="tab"
          [class.is-active]="isPresetActive(option.id)"
          [attr.aria-selected]="isPresetActive(option.id)"
          (click)="selectPreset(option.id)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dash-range {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 0.75rem;
    }
    .dash-range__presets {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 0.25rem;
      padding: 0.15rem;
      border: 1px solid var(--cf-panel-border);
      border-radius: var(--cf-radius-pill);
      background: var(--cf-panel-bg);
    }
    .dash-range__preset {
      min-height: 36px;
      padding: 0.25rem 0.7rem;
      border: 0;
      border-radius: var(--cf-radius-pill);
      background: transparent;
      color: var(--cf-muted);
      font: inherit;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
    }
    .dash-range__preset.is-active {
      background: color-mix(in srgb, var(--cf-forest) 14%, var(--cf-panel-bg));
      color: var(--cf-forest);
    }
    .dash-range__preset:focus-visible {
      outline: var(--cf-focus-ring-width) solid var(--cf-focus-ring);
      outline-offset: var(--cf-focus-ring-offset);
    }
  `]
})
export class DashboardDateRangeComponent {
  @Input() preset: DashboardPeriodPreset = 'this_month';
  @Output() readonly rangeChange = new EventEmitter<DashboardDateRangeValue>();

  readonly presets: Array<{ id: DashboardPeriodPreset; label: string }> = [
    { id: 'this_month', label: 'This month' },
    { id: 'this_fy', label: 'This fiscal year' },
    { id: 'last_90', label: 'Last 90 days' }
  ];

  isPresetActive(id: DashboardPeriodPreset): boolean {
    return this.preset === id && this.preset !== 'custom' && this.preset !== 'ytd';
  }

  selectPreset(preset: DashboardPeriodPreset): void {
    (document.activeElement as HTMLElement | null)?.blur?.();
    this.rangeChange.emit({ preset });
  }
}
