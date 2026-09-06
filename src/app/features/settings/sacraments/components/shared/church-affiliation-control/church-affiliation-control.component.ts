import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface ChurchAffiliationValue {
  affiliation_type: 'home_parish' | 'other' | null;
  affiliation_parish_name?: string;
  affiliation_parish_address?: string;
  affiliation_diocese_name?: string;
  affiliation_diocese_region?: string;
  affiliation_diocese_country?: string;
}

@Component({
  selector: 'app-church-affiliation-control',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './church-affiliation-control.component.html',
  styleUrl: './church-affiliation-control.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChurchAffiliationControlComponent implements OnChanges {
  @Input() label = 'Church affiliation';
  /** Unique radio group name when multiple affiliation controls appear (e.g. bride/groom). */
  @Input() controlId = 'default';
  @Input() homeParishName = '';
  @Input() requireDioceseWhenOther = true;
  /** When false, the long explanatory hint is omitted (e.g. shown once at section level). */
  @Input() showHint = true;
  @Input() value: ChurchAffiliationValue | null = null;
  @Output() valueChange = new EventEmitter<ChurchAffiliationValue>();

  affiliationType: 'home_parish' | 'other' | null = 'home_parish';
  parishName = '';
  parishAddress = '';
  dioceseName = '';
  dioceseRegion = '';
  dioceseCountry = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && this.value) {
      this.affiliationType = this.value.affiliation_type;
      this.parishName = this.value.affiliation_parish_name || '';
      this.parishAddress = this.value.affiliation_parish_address || '';
      this.dioceseName = this.value.affiliation_diocese_name || '';
      this.dioceseRegion = this.value.affiliation_diocese_region || '';
      this.dioceseCountry = this.value.affiliation_diocese_country || '';
    }
  }

  onTypeChange(next: 'home_parish' | 'other'): void {
    this.affiliationType = next;
    if (next === 'home_parish' && this.homeParishName) {
      this.parishName = this.homeParishName;
    }
    this.emit();
  }

  onFieldChange(): void {
    this.emit();
  }

  get showOtherFields(): boolean {
    return this.affiliationType === 'other';
  }

  private emit(): void {
    this.valueChange.emit({
      affiliation_type: this.affiliationType,
      affiliation_parish_name: this.parishName.trim() || undefined,
      affiliation_parish_address: this.parishAddress.trim() || undefined,
      affiliation_diocese_name: this.dioceseName.trim() || undefined,
      affiliation_diocese_region: this.dioceseRegion.trim() || undefined,
      affiliation_diocese_country: this.dioceseCountry.trim() || undefined,
    });
  }
}
