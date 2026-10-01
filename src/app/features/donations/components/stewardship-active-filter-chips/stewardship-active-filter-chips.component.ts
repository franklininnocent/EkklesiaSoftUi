import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import {
  CfActiveFilterChip,
  CfActiveFilterChipsComponent,
} from '@shared/components/cf-active-filter-chips/cf-active-filter-chips.component';

/** @deprecated Import `CfActiveFilterChip` from `@shared/components/cf-active-filter-chips`. */
export type StewardshipFilterChip = CfActiveFilterChip;

@Component({
  selector: 'app-stewardship-active-filter-chips',
  standalone: true,
  imports: [CommonModule, CfActiveFilterChipsComponent],
  template: `
    <app-cf-active-filter-chips
      [ngClass]="{ 'cf-active-filters--embedded': embedded }"
      [chips]="chips"
      [showClearAll]="showClearAll"
      (remove)="remove.emit($event)"
      (clearAll)="clearAll.emit()"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StewardshipActiveFilterChipsComponent {
  @Input({ required: true }) chips: CfActiveFilterChip[] = [];
  @Input() showClearAll = true;
  /** Tighter spacing when rendered inside the page header. */
  @Input() embedded = false;

  @Output() remove = new EventEmitter<CfActiveFilterChip>();
  @Output() clearAll = new EventEmitter<void>();
}
