import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';

export interface CfActiveFilterChip {
  key?: string;
  /** Short filter name, e.g. "BCC" or "Project". */
  label: string;
  /** Filter value; when omitted, `label` may contain "Name: value" (legacy). */
  value?: string;
  /** @deprecated Prefer `value`. Kept for stewardship list pages. */
  displayValue?: string;
}

@Component({
  selector: 'app-cf-active-filter-chips',
  standalone: true,
  imports: [CommonModule, CfActionIconComponent],
  templateUrl: './cf-active-filter-chips.component.html',
  styleUrl: './cf-active-filter-chips.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CfActiveFilterChipsComponent {
  @Input({ required: true }) chips: CfActiveFilterChip[] = [];
  @Input() showClearAll = true;
  @Input() regionLabel = 'Active filters';

  @Output() remove = new EventEmitter<CfActiveFilterChip>();
  @Output() clearAll = new EventEmitter<void>();

  trackChip(_index: number, chip: CfActiveFilterChip): string {
    return chip.key ?? chip.label;
  }

  parts(chip: CfActiveFilterChip): { name: string; value: string | null } {
    const explicit = chip.value?.trim() || chip.displayValue?.trim();
    if (explicit) {
      return { name: chip.label, value: explicit };
    }
    const colon = chip.label.indexOf(': ');
    if (colon > 0) {
      return {
        name: chip.label.slice(0, colon).trim(),
        value: chip.label.slice(colon + 2).trim(),
      };
    }
    return { name: chip.label, value: null };
  }

  removeAriaLabel(chip: CfActiveFilterChip): string {
    const { name } = this.parts(chip);
    return `Remove ${name} filter`;
  }
}
