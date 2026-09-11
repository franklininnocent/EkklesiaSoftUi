import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Family } from '@core/models/family.model';
import { SacramentTypeDto } from '@core/services/sacrament-type-lookup.service';
import {
  FamilySummaryViewModel,
  HierarchyGroupKey,
  HierarchyGroupViewModel,
  NavFlatRow,
  NavMemberRow,
  NavigatorFilterKey
} from '../../models/family-navigator.model';
import {
  applyNavigatorFilters,
  buildHierarchyGroups,
  matchesMemberSearch
} from '../../utils/family-hierarchy.util';
import { formatFamilyAddress } from '../../utils/family-address.util';
import { FamilySummaryCardComponent } from '../family-summary-card/family-summary-card.component';
import { FamilyNavSearchComponent } from '../family-nav-search/family-nav-search.component';
import { FamilyHierarchyGroupComponent } from '../family-hierarchy-group/family-hierarchy-group.component';
import { MemberNavRowComponent } from '../member-nav-row/member-nav-row.component';
import { AddMemberIconButtonComponent } from '@shared/components/add-member-icon-button/add-member-icon-button.component';
import { ImageViewerComponent } from '@shared/components/image-viewer/image-viewer.component';

const VIRTUAL_SCROLL_THRESHOLD = 15;
const ROW_HEIGHT_PX = 90;
const GROUP_HEADER_HEIGHT_PX = 36;
const VIRTUAL_BUFFER_ROWS = 4;

@Component({
  selector: 'app-family-relationship-navigator',
  standalone: true,
  imports: [
    CommonModule,
    FamilySummaryCardComponent,
    FamilyNavSearchComponent,
    FamilyHierarchyGroupComponent,
    MemberNavRowComponent,
    AddMemberIconButtonComponent,
    ImageViewerComponent
  ],
  templateUrl: './family-relationship-navigator.component.html',
  styleUrls: ['./family-relationship-navigator.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FamilyRelationshipNavigatorComponent implements OnChanges {
  constructor(private readonly cdr: ChangeDetectorRef) {}

  @Input({ required: true }) family!: Family;
  @Input() parishName = '';
  @Input() headMemberId: string | null = null;
  @Input() headImageUrl: string | null = null;
  @Input() sacramentTypes: SacramentTypeDto[] = [];
  @Input() selectedMemberId: string | null = null;
  @Input() searchQuery = '';
  @Input() activeFilters: NavigatorFilterKey[] = [];

  @Output() selectMember = new EventEmitter<number>();
  @Output() editFamily = new EventEmitter<void>();
  @Output() addMember = new EventEmitter<void>();
  @Output() searchQueryChange = new EventEmitter<string>();
  @Output() filterToggle = new EventEmitter<NavigatorFilterKey>();

  @ViewChild('listbox') listboxRef?: ElementRef<HTMLElement>;
  @ViewChild('virtualViewport') virtualViewportRef?: ElementRef<HTMLElement>;

  summary: FamilySummaryViewModel = {
    familyName: '',
    familyCode: '',
    familyStatus: 'active',
    parishName: '',
    memberCount: 0,
    familyAddress: null,
    bccName: 'Not assigned',
    bccCode: null
  };

  groups: HierarchyGroupViewModel[] = [];
  flatRows: NavFlatRow[] = [];
  visibleFlatRows: NavFlatRow[] = [];
  useVirtualScroll = false;
  expandedGroups = new Map<HierarchyGroupKey, boolean>();
  focusedFlatIndex = 0;

  virtualPaddingTop = 0;
  virtualPaddingBottom = 0;

  photoViewer: { src: string; alt: string; title: string; subtitle: string } | null = null;

  readonly virtualRowHeight = ROW_HEIGHT_PX;
  readonly groupHeaderHeight = GROUP_HEADER_HEIGHT_PX;

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['family'] ||
      changes['searchQuery'] ||
      changes['activeFilters'] ||
      changes['headMemberId']
    ) {
      this.rebuildView();
    }
  }

  private rebuildView(): void {
    const filterSet = new Set(this.activeFilters);
    const memberFilter = (vm: Parameters<typeof applyNavigatorFilters>[0]) => {
      if (!applyNavigatorFilters(vm, filterSet)) {
        return false;
      }
      return matchesMemberSearch(vm, this.searchQuery, this.family.family_code);
    };

    this.summary = {
      familyName: this.family.family_name,
      familyCode: this.family.family_code,
      familyStatus: this.family.status ?? 'active',
      parishName: this.parishName,
      memberCount: this.family.members?.length ?? 0,
      familyAddress: formatFamilyAddress(this.family),
      bccName: this.family.bcc?.name ?? 'Not assigned',
      bccCode: this.family.bcc?.bcc_code ?? null
    };

    this.groups = buildHierarchyGroups(
      this.family,
      this.headMemberId,
      this.headImageUrl,
      this.sacramentTypes,
      memberFilter
    );

    for (const g of this.groups) {
      if (!this.expandedGroups.has(g.key)) {
        this.expandedGroups.set(g.key, g.defaultExpanded);
      }
    }

    this.flatRows = this.buildFlatRows();
    const memberRowCount = this.flatRows.filter((r) => r.type === 'member').length;
    this.useVirtualScroll = memberRowCount > VIRTUAL_SCROLL_THRESHOLD;
    this.updateVisibleRows(0);
    this.syncFocusedIndex();
  }

  private buildFlatRows(): NavFlatRow[] {
    const rows: NavFlatRow[] = [];
    for (const group of this.groups) {
      const expanded = this.expandedGroups.get(group.key) ?? group.defaultExpanded;
      rows.push({
        type: 'group-header',
        groupKey: group.key,
        label: group.label,
        memberCount: group.members.length,
        expanded
      });
      if (expanded) {
        for (const vm of group.members) {
          rows.push({ type: 'member', vm });
        }
      }
    }
    return rows;
  }

  private rowHeightAt(index: number): number {
    const row = this.flatRows[index];
    return row?.type === 'group-header' ? GROUP_HEADER_HEIGHT_PX : ROW_HEIGHT_PX;
  }

  private totalContentHeight(): number {
    return this.flatRows.reduce((sum, _, i) => sum + this.rowHeightAt(i), 0);
  }

  private updateVisibleRows(scrollTop: number): void {
    if (!this.useVirtualScroll || this.flatRows.length === 0) {
      this.visibleFlatRows = this.flatRows;
      this.virtualPaddingTop = 0;
      this.virtualPaddingBottom = 0;
      return;
    }

    const viewportHeight =
      this.virtualViewportRef?.nativeElement?.clientHeight ?? 400;
    let offset = 0;
    let startIndex = 0;
    let endIndex = this.flatRows.length - 1;

    for (let i = 0; i < this.flatRows.length; i++) {
      const h = this.rowHeightAt(i);
      if (offset + h > scrollTop - VIRTUAL_BUFFER_ROWS * ROW_HEIGHT_PX) {
        startIndex = i;
        break;
      }
      offset += h;
    }

    this.virtualPaddingTop = offset;
    let visibleHeight = 0;
    endIndex = startIndex;

    for (let i = startIndex; i < this.flatRows.length; i++) {
      const h = this.rowHeightAt(i);
      visibleHeight += h;
      endIndex = i;
      if (visibleHeight >= viewportHeight + VIRTUAL_BUFFER_ROWS * ROW_HEIGHT_PX * 2) {
        break;
      }
    }

    this.visibleFlatRows = this.flatRows.slice(startIndex, endIndex + 1);
    let renderedHeight = 0;
    for (let i = startIndex; i <= endIndex; i++) {
      renderedHeight += this.rowHeightAt(i);
    }
    this.virtualPaddingBottom = Math.max(
      0,
      this.totalContentHeight() - this.virtualPaddingTop - renderedHeight
    );
    this.cdr.markForCheck();
  }

  onVirtualScroll(event: Event): void {
    const el = event.target as HTMLElement;
    this.updateVisibleRows(el.scrollTop);
  }

  private syncFocusedIndex(): void {
    if (!this.selectedMemberId) {
      this.focusedFlatIndex = this.findFirstMemberFlatIndex();
      return;
    }
    const idx = this.flatRows.findIndex(
      (r) => r.type === 'member' && r.vm.member.id === this.selectedMemberId
    );
    this.focusedFlatIndex = idx >= 0 ? idx : this.findFirstMemberFlatIndex();
  }

  private findFirstMemberFlatIndex(): number {
    return this.flatRows.findIndex((r) => r.type === 'member');
  }

  isGroupExpanded(key: HierarchyGroupKey): boolean {
    return this.expandedGroups.get(key) ?? true;
  }

  onGroupExpandedChange(key: HierarchyGroupKey, expanded: boolean): void {
    this.expandedGroups.set(key, expanded);
    this.flatRows = this.buildFlatRows();
    const memberRowCount = this.flatRows.filter((r) => r.type === 'member').length;
    this.useVirtualScroll = memberRowCount > VIRTUAL_SCROLL_THRESHOLD;
    this.updateVisibleRows(
      this.virtualViewportRef?.nativeElement?.scrollTop ?? 0
    );
  }

  onFilterToggle(key: NavigatorFilterKey): void {
    this.filterToggle.emit(key);
  }

  get focusedMemberIndex(): number | null {
    const row = this.flatRows[this.focusedFlatIndex];
    if (row?.type === 'member') {
      return row.vm.memberIndex;
    }
    return null;
  }

  trackFlatRow = (_index: number, row: NavFlatRow): string => {
    if (row.type === 'group-header') {
      return `g-${row.groupKey}`;
    }
    return `m-${row.vm.member.id}`;
  };

  isMemberRow(row: NavFlatRow): row is NavMemberRow {
    return row.type === 'member';
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.listboxRef?.nativeElement.contains(event.target as Node)) {
      return;
    }
    const memberIndices = this.flatRows
      .map((r, i) => (r.type === 'member' ? i : -1))
      .filter((i) => i >= 0);
    if (memberIndices.length === 0) {
      return;
    }

    const currentPos = memberIndices.indexOf(this.focusedFlatIndex);
    let nextPos = currentPos;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      nextPos = currentPos < memberIndices.length - 1 ? currentPos + 1 : 0;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      nextPos = currentPos > 0 ? currentPos - 1 : memberIndices.length - 1;
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const row = this.flatRows[this.focusedFlatIndex];
      if (row?.type === 'member') {
        this.selectMember.emit(row.vm.memberIndex);
      }
      return;
    } else {
      return;
    }

    this.focusedFlatIndex = memberIndices[nextPos];
    this.focusMemberOption();
  }

  private focusMemberOption(): void {
    const row = this.flatRows[this.focusedFlatIndex];
    if (row?.type !== 'member') {
      return;
    }
    const el = document.getElementById(`nav-member-${row.vm.memberIndex}`);
    el?.focus();
  }

  onMemberSelect(index: number): void {
    this.selectMember.emit(index);
    const flatIdx = this.flatRows.findIndex(
      (r) => r.type === 'member' && r.vm.memberIndex === index
    );
    if (flatIdx >= 0) {
      this.focusedFlatIndex = flatIdx;
    }
  }

  openPhotoViewer(payload: { src: string; alt: string; title: string; subtitle: string }): void {
    this.photoViewer = payload;
    this.cdr.detectChanges();
  }

  closePhotoViewer(): void {
    this.photoViewer = null;
    this.cdr.detectChanges();
  }
}
