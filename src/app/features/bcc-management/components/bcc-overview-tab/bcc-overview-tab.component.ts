import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { BCCService } from '@core/services/bcc.service';
import { ApiResponse } from '@core/models/family.model';
import { CfEmptyStateComponent } from '@shared/components/cf-empty-state/cf-empty-state.component';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import {
  BccAgeBand,
  BccAgeGroup,
  BccOverview,
  BccTab,
} from '../../models/bcc.model';
import { BccGrowthMeasure, BccGrowthPanelComponent } from '../dashboard/bcc-growth-panel.component';
import {
  BccOverviewChartComponent,
  BccOverviewChartSlice,
} from './bcc-overview-chart.component';

interface DistributionRow {
  key: string;
  label: string;
  count: number;
  percent: number;
  muted?: boolean;
  clickable?: boolean;
}

const FAMILY_SIZE_COLORS: Record<string, string> = {
  size_1: '#2563eb',
  size_2_to_4: '#0d9488',
  size_5_plus: '#7c3aed',
};

const LIFE_STAGE_COLORS: Record<string, string> = {
  babies: '#2563eb',
  children: '#0d9488',
  teenagers: '#0891b2',
  young_adults: '#7c3aed',
  adults: '#ca8a04',
  seniors: '#be123c',
  unknown: '#cbd5e1',
};

const MEMBERSHIP_COLORS: Record<string, string> = {
  active: '#166534',
  inactive: '#ca8a04',
  deceased: '#64748b',
  migrated: '#2563eb',
};

const GENDER_COLORS: Record<string, string> = {
  male: '#2563eb',
  female: '#0d9488',
  other: '#7c3aed',
  unknown: '#cbd5e1',
};

@Component({
  selector: 'app-bcc-overview-tab',
  standalone: true,
  imports: [
    CommonModule,
    LoadingSkeletonComponent,
    CfEmptyStateComponent,
    BccGrowthPanelComponent,
    BccOverviewChartComponent,
  ],
  templateUrl: './bcc-overview-tab.component.html',
  styleUrl: './bcc-overview-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BccOverviewTabComponent implements OnChanges {
  @Input({ required: true }) bccId!: string;
  @Input() canManageMembers = false;
  @Output() navigate = new EventEmitter<{ tab: BccTab; query?: Record<string, string> }>();
  @Output() overviewLoaded = new EventEmitter<BccOverview>();

  private readonly api = inject(BCCService);
  private readonly cdr = inject(ChangeDetectorRef);

  loading = true;
  loadError: string | null = null;
  overview: BccOverview | null = null;
  growthMeasure: BccGrowthMeasure = 'people';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['bccId'] && this.bccId) {
      this.load();
    }
  }

  load(): void {
    this.loading = true;
    this.loadError = null;
    this.api.getOverview(this.bccId).subscribe({
      next: (res: ApiResponse<unknown>) => {
        const data = (res.data as BccOverview) ?? null;
        if (data) {
          data.attention = data.attention ?? [];
          data.data_quality = data.data_quality ?? {
            complete_count: 0,
            incomplete_count: 0,
            total: data.total_members ?? 0,
            definition: 'Complete means gender and date of birth are recorded.',
          };
          data.growth = data.growth ?? {
            period: '',
            insufficient_history: true,
            members: [],
            families: [],
          };
        }
        this.overview = data;
        this.loading = false;
        if (this.overview) {
          this.overviewLoaded.emit(this.overview);
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadError = 'Unable to load BCC overview. Please try again.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  go(tab: BccTab, query?: Record<string, string>): void {
    this.navigate.emit({ tab, query });
  }

  onGrowthMeasure(measure: BccGrowthMeasure): void {
    this.growthMeasure = measure;
    this.cdr.markForCheck();
  }

  activeRatio(overview: BccOverview): string {
    if (!overview.total_members) {
      return '0%';
    }
    return `${((overview.active_members / overview.total_members) * 100).toFixed(1)}%`;
  }

  communityGlance(overview: BccOverview): string {
    const parts: string[] = [];
    const members = overview.total_members;
    const families = overview.total_families;

    if (members === 0 && families === 0) {
      return 'This BCC currently has no members or families assigned.';
    }

    parts.push(
      `${members} ${members === 1 ? 'member' : 'members'} across ${families} ${
        families === 1 ? 'family' : 'families'
      }.`
    );

    if (members > 0) {
      parts.push(
        `${overview.active_members} ${
          overview.active_members === 1 ? 'member is' : 'members are'
        } active.`
      );
    }

    const babies = overview.babies?.total ?? 0;
    const children = overview.children?.total ?? 0;
    const adults = overview.age_groups?.adults?.count ?? 0;
    const seniors = overview.age_groups?.seniors?.count ?? 0;
    const lifeBits: string[] = [];
    if (babies > 0) {
      lifeBits.push(`${babies} ${babies === 1 ? 'is a baby' : 'are babies'}`);
    }
    if (children > 0) {
      lifeBits.push(`${children} ${children === 1 ? 'is a child' : 'are children'}`);
    }
    if (adults > 0) {
      lifeBits.push(`${adults} ${adults === 1 ? 'is an adult' : 'are adults'}`);
    }
    if (seniors > 0) {
      lifeBits.push(`${seniors} ${seniors === 1 ? 'is a senior' : 'are seniors'}`);
    }
    if (lifeBits.length) {
      const sentence = lifeBits.join(', ').replace(/, ([^,]*)$/, ', and $1');
      parts.push(`${sentence[0].toUpperCase()}${sentence.slice(1)}.`);
    }

    const incomplete = overview.data_quality?.incomplete_count ?? 0;
    if (incomplete > 0) {
      parts.push(
        `Demographic information is incomplete for ${incomplete} ${
          incomplete === 1 ? 'member' : 'members'
        }.`
      );
    }

    return parts.join(' ');
  }

  familySizeSlices(overview: BccOverview): BccOverviewChartSlice[] {
    return this.familySizeRows(overview).map((row) => ({
      key: row.key,
      label: row.label,
      count: row.count,
      color: FAMILY_SIZE_COLORS[row.key],
    }));
  }

  familySizeSummary(overview: BccOverview): string {
    const parts = this.familySizeRows(overview).map((row) => `${row.label}: ${row.count}`);
    return `Family size distribution across ${overview.total_families} ${
      overview.total_families === 1 ? 'family' : 'families'
    }. ${parts.join(', ')}.`;
  }

  lifeStageSlices(overview: BccOverview): BccOverviewChartSlice[] {
    const { recorded, unknown } = this.lifeStageRows(overview);
    const slices: BccOverviewChartSlice[] = recorded.map((group) => ({
      key: group.key,
      label: group.label,
      count: group.count,
      color: LIFE_STAGE_COLORS[group.key] || '#94a3b8',
      drillable: true,
    }));
    if (unknown) {
      slices.push({
        key: unknown.key,
        label: 'Not recorded',
        count: unknown.count,
        color: LIFE_STAGE_COLORS['unknown'],
        drillable: true,
      });
    }
    return slices;
  }

  zeroLifeStages(overview: BccOverview): string[] {
    return this.lifeStageRows(overview)
      .recorded.filter((group) => group.count === 0)
      .map((group) => group.label);
  }

  membershipSlices(overview: BccOverview): BccOverviewChartSlice[] {
    return this.membershipRows(overview).map((row) => ({
      key: row.key,
      label: row.label,
      count: row.count,
      color: MEMBERSHIP_COLORS[row.key],
      drillable: !!row.clickable,
    }));
  }

  membershipSummary(overview: BccOverview): string {
    const parts = this.membershipRows(overview).map(
      (row) => `${row.label}: ${row.count} (${row.percent.toFixed(1)}%)`
    );
    return `Membership status of ${overview.total_members} ${
      overview.total_members === 1 ? 'member' : 'members'
    }. ${parts.join(', ')}.`;
  }

  onLifeStageSlice(slice: BccOverviewChartSlice): void {
    this.go('members', { view: 'people', age_band: slice.key });
  }

  onMembershipSlice(slice: BccOverviewChartSlice): void {
    this.go('members', { view: 'people', status: slice.key });
  }

  onGenderSlice(slice: BccOverviewChartSlice): void {
    this.go('members', { view: 'people', gender: slice.key });
  }

  genderSlices(overview: BccOverview): BccOverviewChartSlice[] {
    return [
      {
        key: 'male',
        label: 'Male',
        count: overview.gender.male.count,
        color: GENDER_COLORS['male'],
        drillable: true,
      },
      {
        key: 'female',
        label: 'Female',
        count: overview.gender.female.count,
        color: GENDER_COLORS['female'],
        drillable: true,
      },
      {
        key: 'other',
        label: 'Other',
        count: overview.gender.other.count,
        color: GENDER_COLORS['other'],
        drillable: true,
      },
      {
        key: 'unknown',
        label: 'Not recorded',
        count: overview.gender.unknown.count,
        color: GENDER_COLORS['unknown'],
        drillable: true,
      },
    ];
  }

  familySizeRows(overview: BccOverview): DistributionRow[] {
    const total = Math.max(overview.families.total, 1);
    const rows = [
      { key: 'size_1', label: '1 member', count: overview.families.size_1 },
      { key: 'size_2_to_4', label: '2–4 members', count: overview.families.size_2_to_4 },
      { key: 'size_5_plus', label: '5+ members', count: overview.families.size_5_plus },
    ];
    return rows.map((row) => ({
      ...row,
      percent: overview.families.total > 0 ? (row.count / total) * 100 : 0,
      muted: row.count === 0,
    }));
  }

  membershipRows(overview: BccOverview): DistributionRow[] {
    const total = Math.max(overview.total_members, 1);
    const rows = [
      {
        key: 'active',
        label: 'Active',
        count: overview.membership_status.active,
        clickable: true,
      },
      {
        key: 'inactive',
        label: 'Inactive',
        count: overview.membership_status.inactive,
        clickable: true,
      },
      { key: 'deceased', label: 'Deceased', count: overview.membership_status.deceased },
      {
        key: 'migrated',
        label: 'Transferred',
        count: overview.membership_status.migrated,
      },
    ];
    return rows.map((row) => ({
      ...row,
      percent: overview.total_members > 0 ? (row.count / total) * 100 : 0,
      muted: row.count === 0,
    }));
  }

  lifeStageRows(overview: BccOverview): {
    recorded: Array<BccAgeGroup & { key: BccAgeBand }>;
    unknown: (BccAgeGroup & { key: BccAgeBand }) | null;
  } {
    const entries = (Object.entries(overview.age_groups || {}) as Array<[BccAgeBand, BccAgeGroup]>).map(
      ([key, group]) => ({ ...group, key })
    );
    const unknown = entries.find((row) => row.key === 'unknown') ?? null;
    const recorded = entries.filter((row) => row.key !== 'unknown');
    return { recorded, unknown };
  }

  genderKnownTotal(overview: BccOverview): number {
    return (
      overview.gender.male.count + overview.gender.female.count + overview.gender.other.count
    );
  }

  genderKnownPercent(overview: BccOverview): number {
    if (!overview.total_members) {
      return 0;
    }
    return Math.round((this.genderKnownTotal(overview) / overview.total_members) * 1000) / 10;
  }

  completenessPercent(overview: BccOverview): number {
    if (!overview.data_quality?.total) {
      return 0;
    }
    return Math.round((overview.data_quality.complete_count / overview.data_quality.total) * 1000) / 10;
  }

  lifeStageSummary(overview: BccOverview): string {
    const { recorded, unknown } = this.lifeStageRows(overview);
    const parts = recorded
      .filter((row) => row.count > 0)
      .map((row) => `${row.count} ${row.label.toLowerCase()}`);
    if (unknown && unknown.count > 0) {
      parts.push(
        `${unknown.count} ${unknown.count === 1 ? 'member' : 'members'} without recorded date of birth`
      );
    }
    const zeroStages = recorded.filter((row) => row.count === 0).map((row) => row.label.toLowerCase());
    let text = parts.length ? parts.join(', ') : 'No life-stage counts available';
    if (zeroStages.length) {
      text += `; ${zeroStages.join(', ')} have zero members`;
    }
    return `Life stage distribution: ${text}.`;
  }

  genderSummary(overview: BccOverview): string {
    return `Gender composition: ${overview.gender.male.count} male, ${overview.gender.female.count} female, ${overview.gender.other.count} other, ${overview.gender.unknown.count} not recorded.`;
  }
}
