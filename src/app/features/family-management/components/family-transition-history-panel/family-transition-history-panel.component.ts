import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FamilyService } from '@core/services/family.service';
import { FamilyTransitionHistoryRecord } from '@core/models/family.model';

@Component({
  selector: 'app-family-transition-history-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './family-transition-history-panel.component.html',
  styleUrl: './family-transition-history-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FamilyTransitionHistoryPanelComponent implements OnInit, OnChanges {
  private readonly familyService = inject(FamilyService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input({ required: true }) familyId!: string;

  records: FamilyTransitionHistoryRecord[] = [];
  loading = true;
  error: string | null = null;

  ngOnInit(): void {
    this.loadHistory();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['familyId'] && !changes['familyId'].firstChange) {
      this.loadHistory();
    }
  }

  reload(): void {
    this.loadHistory();
  }

  memberName(record: FamilyTransitionHistoryRecord): string {
    const member = record.member;
    if (!member) {
      return 'Unknown member';
    }
    return [member.first_name, member.last_name].filter(Boolean).join(' ').trim() || 'Unknown member';
  }

  transitionLabel(type: string): string {
    switch (type) {
      case 'RELOCATION':
        return 'BCC move';
      case 'MARRIAGE':
        return 'Marriage — new household';
      case 'JOIN':
        return 'Marriage — joined household';
      case 'SUCCESSION':
        return 'Head of family change';
      case 'ADMIN_CORRECTION':
        return 'History correction';
      default:
        return type.replace(/_/g, ' ');
    }
  }

  formatDate(value: string | undefined): string {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  private loadHistory(): void {
    if (!this.familyId) {
      this.records = [];
      this.loading = false;
      this.error = 'Family not loaded.';
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.familyService.getTransitionHistory(this.familyId).subscribe({
      next: (response) => {
        this.records = response.data ?? [];
        this.loading = false;
        this.error = response.success ? null : response.message || 'Could not load history.';
        this.cdr.markForCheck();
      },
      error: () => {
        this.records = [];
        this.loading = false;
        this.error = 'Could not load household history. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }
}
