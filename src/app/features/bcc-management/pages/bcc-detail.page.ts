import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { BCCService } from '@core/services/bcc.service';
import { ToastService } from '@core/services/toast.service';
import { BCC } from '@core/models/family.model';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { StatusBadgeComponent, StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { TabStripComponent, TabStripItem } from '@shared/components/tab-strip/tab-strip.component';
import { BCCFormComponent } from '../components/bcc-form/bcc-form';
import { BccOverviewTabComponent } from '../components/bcc-overview-tab/bcc-overview-tab.component';
import { BccMembersTabComponent } from '../components/bcc-members-tab/bcc-members-tab.component';
import { BccLeadershipTabComponent } from '../components/bcc-leadership-tab/bcc-leadership-tab.component';
import { BccHistoryTabComponent } from '../components/bcc-history-tab/bcc-history-tab.component';
import { BccAuditTabComponent } from '../components/bcc-audit-tab/bcc-audit-tab.component';
import { BccOverview, BccTab } from '../models/bcc.model';

const TABS: BccTab[] = ['overview', 'members', 'leadership', 'member-history', 'audit'];

@Component({
  selector: 'app-bcc-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LoadingSkeletonComponent,
    StatusBadgeComponent,
    TabStripComponent,
    BCCFormComponent,
    BccOverviewTabComponent,
    BccMembersTabComponent,
    BccLeadershipTabComponent,
    BccHistoryTabComponent,
    BccAuditTabComponent,
  ],
  templateUrl: './bcc-detail.page.html',
  styleUrl: './bcc-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BccDetailPageComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(BCCService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  bcc: BCC | null = null;
  loading = true;
  loadError: string | null = null;
  activeTab: BccTab = 'overview';
  peopleQuery: Record<string, string> = {};
  showForm = false;
  memberCount: number | null = null;
  leadershipCount: number | null = null;
  copyFeedback = false;

  tabItems: TabStripItem[] = this.buildTabItems();

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.load(id);
      }
    });
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe((query) => {
      const tab = query.get('tab') as BccTab | null;
      this.activeTab = tab && TABS.includes(tab) ? tab : 'overview';
      this.peopleQuery = {
        view: query.get('view') || '',
        gender: query.get('gender') || '',
        status: query.get('status') || '',
        age_band: query.get('age_band') || '',
      };
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(id: string): void {
    this.loading = true;
    this.loadError = null;
    this.memberCount = null;
    this.leadershipCount = null;
    this.tabItems = this.buildTabItems();
    this.api.getBCC(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        this.bcc = res.data ?? null;
        this.loading = false;
        if (!this.bcc) {
          this.loadError = 'BCC not found.';
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadError = 'Could not load this BCC.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  setTab(tab: string): void {
    const next = (TABS.includes(tab as BccTab) ? tab : 'overview') as BccTab;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: next === 'overview' ? null : next },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onOverviewNavigate(event: { tab: BccTab; query?: Record<string, string> }): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: event.tab === 'overview' ? null : event.tab, ...(event.query || {}) },
      replaceUrl: true,
    });
  }

  onMembersQueryChange(query: Record<string, string>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        view: query['view'] === 'people' ? null : query['view'] || null,
        gender: query['gender'] || null,
        status: query['status'] || null,
        age_band: query['age_band'] || null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  onOverviewLoaded(overview: BccOverview): void {
    this.memberCount = overview.total_members;
    this.leadershipCount = overview.leadership?.active_count ?? null;
    this.tabItems = this.buildTabItems();
    this.cdr.markForCheck();
  }

  statusTone(status?: string): StatusBadgeTone {
    if (status === 'active') return 'success';
    if (status === 'suspended') return 'warning';
    return 'neutral';
  }

  get canEdit(): boolean {
    return this.auth.hasPermission('bcc.edit');
  }

  get canManageMembers(): boolean {
    return this.auth.hasPermission('bcc.manage_members');
  }

  get descriptionText(): string {
    const value = (this.bcc?.description || '').trim();
    return value;
  }

  get hasMeetingMeta(): boolean {
    return !!(this.bcc?.meeting_day || this.bcc?.meeting_time || this.bcc?.meeting_place);
  }

  /** Up to two initials from the BCC name, falling back to the code prefix. */
  get monogram(): string {
    const words = (this.bcc?.name || '').trim().split(/\s+/).filter(Boolean);
    const letters = words
      .map((word) => word[0])
      .filter((char) => /[a-z0-9]/i.test(char))
      .slice(0, 2)
      .join('');
    return (letters || this.bcc?.bcc_code?.slice(0, 2) || 'B').toUpperCase();
  }

  /** "Tuesday · 10:14 AM · Weekly" from whichever meeting fields are present. */
  get meetingSchedule(): string {
    const parts: string[] = [];
    const day = this.bcc?.meeting_day;
    if (day) {
      parts.push(day.charAt(0).toUpperCase() + day.slice(1));
    }
    const time = this.formatMeetingTime(this.bcc?.meeting_time);
    if (time) {
      parts.push(time);
    }
    if (this.bcc?.meeting_frequency) {
      parts.push(this.bcc.meeting_frequency);
    }
    return parts.join(' · ');
  }

  private formatMeetingTime(value?: string | null): string {
    if (!value) {
      return '';
    }
    const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
    if (!match) {
      return value.trim();
    }
    const hours = Number(match[1]);
    const minutes = match[2];
    if (Number.isNaN(hours) || hours > 23) {
      return value.trim();
    }
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${hour12}:${minutes} ${suffix}`;
  }

  openEdit(): void {
    if (!this.canEdit || !this.bcc) {
      return;
    }
    this.showForm = true;
    this.cdr.markForCheck();
  }

  onFormSave(): void {
    this.showForm = false;
    this.toast.success('BCC saved successfully.', 'Success');
    if (this.bcc?.id) {
      this.load(this.bcc.id);
    }
  }

  onFormCancel(): void {
    this.showForm = false;
    this.cdr.markForCheck();
  }

  async copyBccCode(): Promise<void> {
    const code = this.bcc?.bcc_code;
    if (!code) {
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      this.copyFeedback = true;
      this.toast.success('BCC ID copied', 'Copied', 2000);
      window.setTimeout(() => {
        this.copyFeedback = false;
        this.cdr.markForCheck();
      }, 1500);
      this.cdr.markForCheck();
    } catch {
      this.toast.error('Could not copy BCC ID', 'Error');
    }
  }

  private buildTabItems(): TabStripItem[] {
    const membersLabel =
      this.memberCount === null ? 'Members' : `Members · ${this.memberCount}`;
    const leadershipLabel =
      this.leadershipCount === null ? 'Leadership' : `Leadership · ${this.leadershipCount}`;
    return [
      { id: 'overview', label: 'Overview' },
      { id: 'members', label: membersLabel },
      { id: 'leadership', label: leadershipLabel },
      { id: 'member-history', label: 'Member History' },
      { id: 'audit', label: 'Audit' },
    ];
  }
}
