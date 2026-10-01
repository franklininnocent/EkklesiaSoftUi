import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import { ChurchLeadership } from '@core/models/church';
import { ChurchLeadershipService } from '@core/services/church/church-leadership.service';
import { LEADERSHIP_ROLE_OPTIONS } from '../church-leader-workspace/church-leader-role.config';
import { cfFormatDate } from '@shared/utils/cf-intl.util';
import { CfBrandLoaderComponent } from '@shared/components/cf-brand-loader/cf-brand-loader.component';
import { CF_OVERLAY_Z, CfOverlayHandle, CfOverlayStackService } from '@core/services/cf-overlay-stack.service';

interface ParsedBiography {
  biography: string;
  whatsapp?: string;
  alternateContact?: string;
}

@Component({
  selector: 'app-church-leader-detail',
  standalone: true,
  imports: [CommonModule, CfBrandLoaderComponent],
  templateUrl: './church-leader-detail.component.html',
  styleUrl: './church-leader-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChurchLeaderDetailComponent implements OnChanges, OnDestroy {
  private readonly leadershipService = inject(ChurchLeadershipService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly overlayStack = inject(CfOverlayStackService);
  private overlayHandle: CfOverlayHandle | null = null;
  overlayZIndex: number = CF_OVERLAY_Z.drawer;

  @Input() open = false;
  @Input() leader: ChurchLeadership | null = null;
  @Input() canManage = false;

  @Output() closed = new EventEmitter<void>();
  @Output() editRequested = new EventEmitter<ChurchLeadership>();
  @Output() deleteRequested = new EventEmitter<ChurchLeadership>();

  readonly roleOptions = LEADERSHIP_ROLE_OPTIONS;

  detailLeader: ChurchLeadership | null = null;
  loading = false;
  loadError: string | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']) {
      if (this.open) {
        this.registerOverlay();
      } else {
        this.releaseOverlay();
      }
    }
    if ((changes['open']?.currentValue || changes['leader']) && this.open && this.leader) {
      this.loadLeaderDetails(this.leader.id);
    }
    if (changes['open'] && !this.open) {
      this.detailLeader = null;
      this.loadError = null;
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    this.releaseOverlay();
  }

  get displayLeader(): ChurchLeadership | null {
    return this.detailLeader ?? this.leader;
  }

  get roleIcon(): string {
    const role = this.displayLeader?.role;
    return this.roleOptions.find((option) => option.value === role)?.icon ?? '👤';
  }

  get statusLabel(): string {
    const leader = this.displayLeader;
    if (!leader) {
      return 'Unknown';
    }
    if (Number(leader.active) === 1) {
      return 'Active';
    }
    if (leader.relieved_date) {
      return 'Former Leader';
    }
    return 'Inactive';
  }

  get statusTone(): string {
    const leader = this.displayLeader;
    if (!leader) {
      return 'neutral';
    }
    if (Number(leader.active) === 1) {
      return 'success';
    }
    if (leader.relieved_date) {
      return 'muted';
    }
    return 'neutral';
  }

  get parsedBio(): ParsedBiography {
    return parseLeaderBiography(this.displayLeader?.biography);
  }

  get photoDisplayUrl(): string | null {
    return this.leadershipService.resolveLeaderPhotoUrl(this.displayLeader?.photo_url);
  }

  get displayPhone(): string | null {
    const phone = this.displayLeader?.phone?.trim();
    return phone || null;
  }

  get displayWhatsapp(): string | null {
    const parsed = this.parsedBio.whatsapp;
    if (!parsed) {
      return null;
    }
    if (this.displayPhone === parsed) {
      return null;
    }
    return parsed;
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(event: Event): void {
    if (!this.open || this.loading) {
      return;
    }
    if (this.overlayHandle && !this.overlayHandle.isTop()) {
      return;
    }
    (event as KeyboardEvent).preventDefault();
    (event as KeyboardEvent).stopImmediatePropagation();
    this.requestClose();
  }

  requestClose(): void {
    this.releaseOverlay();
    this.closed.emit();
  }

  private registerOverlay(): void {
    if (this.overlayHandle) {
      return;
    }
    this.overlayHandle = this.overlayStack.push('drawer', () => this.requestClose());
    this.overlayZIndex = this.overlayHandle.zIndex;
  }

  private releaseOverlay(): void {
    this.overlayHandle?.release();
    this.overlayHandle = null;
    this.overlayZIndex = CF_OVERLAY_Z.drawer;
  }

  requestEdit(): void {
    const leader = this.displayLeader;
    if (leader) {
      this.editRequested.emit(leader);
    }
  }

  requestDelete(): void {
    const leader = this.displayLeader;
    if (leader) {
      this.deleteRequested.emit(leader);
    }
  }

  formatDate(value?: string | null): string {
    if (!value) {
      return 'Not set';
    }
    try {
      return cfFormatDate(value) || value;
    } catch {
      return value;
    }
  }

  formatDateTime(value?: string | null): string {
    if (!value) {
      return 'Not set';
    }
    try {
      return cfFormatDate(value, 'datetime') || value;
    } catch {
      return value;
    }
  }

  private loadLeaderDetails(id: number): void {
    this.loading = true;
    this.loadError = null;
    this.cdr.markForCheck();

    this.leadershipService.getLeader(id).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.success && response.data) {
          this.detailLeader = response.data;
        } else {
          this.detailLeader = this.leader;
          this.loadError = 'Could not load the latest leader details.';
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.detailLeader = this.leader;
        this.loadError = 'Showing cached list data. Latest details could not be loaded.';
        this.cdr.markForCheck();
      }
    });
  }
}

function parseLeaderBiography(bio?: string): ParsedBiography {
  if (!bio?.trim()) {
    return { biography: '' };
  }

  const kept: string[] = [];
  let whatsapp: string | undefined;
  let alternateContact: string | undefined;

  for (const line of bio.split('\n')) {
    const trimmed = line.trim();
    const whatsappMatch = trimmed.match(/^WhatsApp:\s*(.+)$/i);
    const alternateMatch = trimmed.match(/^Alternate contact:\s*(.+)$/i);

    if (whatsappMatch) {
      whatsapp = whatsappMatch[1].trim();
    } else if (alternateMatch) {
      alternateContact = alternateMatch[1].trim();
    } else {
      kept.push(line);
    }
  }

  return {
    biography: kept.join('\n').trim(),
    whatsapp,
    alternateContact
  };
}
