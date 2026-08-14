import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { Subject, takeUntil } from 'rxjs';
import { ChurchLeadership } from '@core/models/church';
import { ChurchLeadershipService } from '@core/services/church/church-leadership.service';
import {
  ParticipantSourceKind,
  SacramentParticipantDraft,
} from '../../../models/sacrament-definition.model';

@Component({
  selector: 'app-minister-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, NgSelectModule],
  templateUrl: './minister-picker.component.html',
  styleUrl: './minister-picker.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinisterPickerComponent implements OnInit, OnChanges, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly leadership = inject(ChurchLeadershipService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() ministerRoles: string[] = ['priest', 'deacon', 'pastor', 'other'];
  /** Unique id when multiple minister pickers appear (e.g. Holy Orders co-consecrators). */
  @Input() controlId = 'minister';
  @Input() label = 'Who administered this sacrament?';
  @Input() value: SacramentParticipantDraft | null = null;
  @Output() valueChange = new EventEmitter<SacramentParticipantDraft>();

  source: Extract<ParticipantSourceKind, 'internal_leadership' | 'external'> = 'internal_leadership';
  leaders: ChurchLeadership[] = [];
  loadingLeaders = false;
  selectedLeaderId: number | null = null;

  externalName = '';
  externalTitle = '';
  externalRole = '';

  ngOnInit(): void {
    this.loadLeaders();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && this.value) {
      if (this.value.source === 'internal_leadership') {
        this.source = 'internal_leadership';
        this.selectedLeaderId = this.value.church_leadership_id ?? null;
      } else {
        this.source = 'external';
        this.externalName = this.value.external_full_name || '';
        this.externalTitle = this.value.external_title || '';
        this.externalRole = this.value.external_minister_role || '';
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSourceChange(next: 'internal_leadership' | 'external'): void {
    this.source = next;
    this.emit();
  }

  onLeaderChange(): void {
    this.emit();
  }

  onExternalChange(): void {
    this.emit();
  }

  leaderLabel(leader: ChurchLeadership): string {
    const title = leader.title ? `${leader.title} ` : '';
    return `${title}${leader.full_name} (${leader.role})`;
  }

  private loadLeaders(): void {
    this.loadingLeaders = true;
    this.leadership.getLeaders({ active: 1, current: true })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.leaders = response?.data ?? [];
          this.loadingLeaders = false;
          this.cdr.markForCheck();
        },
        error: () => {
          this.leaders = [];
          this.loadingLeaders = false;
          this.cdr.markForCheck();
        },
      });
  }

  roleLabel(role: string): string {
    const map: Record<string, string> = {
      priest: 'Priest',
      deacon: 'Deacon',
      pastor: 'Pastor',
      bishop: 'Bishop',
      archbishop: 'Archbishop',
      other: 'Other',
    };
    return map[role] || role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private emit(): void {
    const draft: SacramentParticipantDraft = {
      role: 'minister',
      source: this.source,
      sort_order: 0,
    };

    if (this.source === 'internal_leadership') {
      const leader = this.leaders.find((l) => l.id === this.selectedLeaderId);
      draft.church_leadership_id = this.selectedLeaderId;
      draft.display_name = leader ? leader.full_name : undefined;
      draft.external_title = leader?.title || undefined;
      draft.external_minister_role = leader?.role || undefined;
    } else {
      draft.external_full_name = this.externalName.trim();
      draft.display_name = draft.external_full_name;
      draft.external_title = this.externalTitle.trim() || undefined;
      draft.external_minister_role = this.externalRole || undefined;
    }

    this.valueChange.emit(draft);
  }
}
