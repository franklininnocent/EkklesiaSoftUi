import { ChangeDetectorRef, ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FamilyService } from '../../../../core/services/family.service';
import { Family, FamilyMember } from '../../../../core/models/family.model';
import { FamilyFormComponent } from '../family-form/family-form';
import { FamilyMemberFormModalComponent, FamilyMemberFormValue } from '../family-member-form-modal/family-member-form-modal.component';
import { ToastService } from '../../../../core/services/toast.service';
import { CountryCode, getCountryCallingCode, parsePhoneNumber } from 'libphonenumber-js';
import { SacramentEditModalComponent, SacramentFormType } from '../sacrament-edit-modal/sacrament-edit-modal.component';
import { Store } from '@ngrx/store';
import { selectCurrentTenant } from '@core/store/tenant/tenant.selectors';
import { Tenant, Address } from '@core/models/tenant.model';
import { Subject, takeUntil } from 'rxjs';
import { ChurchProfileService } from '@core/services/church/church-profile.service';
import { ChurchProfile } from '@core/models/church';
import { SacramentTypeLookupService, SacramentTypeDto } from '@core/services/sacrament-type-lookup.service';
import { FamilyRelationshipNavigatorComponent } from '../family-relationship-navigator/family-relationship-navigator.component';
import { FamilyMemberDetailPanelComponent } from '../family-member-detail-panel/family-member-detail-panel.component';
import { DonationsService } from '@features/donations/services/donations.service';
import { FamilyFinancialDashboardComponent } from '../family-financial-dashboard/family-financial-dashboard.component';
import { BccTransferModalComponent } from '../bcc-transfer-modal/bcc-transfer-modal.component';
import { MarriageHouseholdModalComponent } from '../marriage-household-modal/marriage-household-modal.component';
import { FamilyTransitionHistoryPanelComponent } from '../family-transition-history-panel/family-transition-history-panel.component';
import { RequestVisitModalComponent } from '@features/pastoral-care/components/request-visit-modal/request-visit-modal.component';
import { PastoralCareService } from '@features/pastoral-care/services/pastoral-care.service';
import { PastoralCareRequest } from '@features/pastoral-care/models/pastoral-care.model';
import { DonationFamilyFinancialProfile } from '@features/donations/models/donation.model';
import { NavigatorFilterKey } from '../../models/family-navigator.model';
import {
  isSacramentCompleted as sacramentCompleted,
  resolveCanonicalSacrament as resolveSacrament
} from '../../utils/sacrament-completion.util';
import {
  extractMemberApiError,
  getMemberApiData,
  getMemberApiMessage,
  isMemberApiSuccess,
  prepareFamilyMemberPayload
} from '../../utils/prepare-family-member-payload.util';
import { PhoneCodeService } from '@core/services/phone-code.service';
import { AuthService } from '@core/services/auth.service';
import { SubscriptionAccessService } from '@core/services/subscription-access.service';
import { SacramentService } from '@features/settings/sacraments/services/sacrament.service';
import { Sacrament } from '@features/settings/sacraments/models/sacrament.model';

type FamilyWorkspaceView = 'members' | 'financial' | 'history';

const WORKSPACE_TABS: FamilyWorkspaceView[] = ['members', 'financial', 'history'];

const DEFAULT_SACRAMENT_TYPES: SacramentTypeDto[] = [
  { id: -1, name: 'Baptism', code: 'baptism', display_order: 1, active: true },
  { id: -2, name: 'First Communion', code: 'first_communion', display_order: 2, active: true },
  { id: -3, name: 'Confirmation', code: 'confirmation', display_order: 3, active: true },
  { id: -4, name: 'Marriage', code: 'marriage', display_order: 4, active: true }
];

@Component({
  selector: 'app-family-detail',
  standalone: true,
  imports: [
    CommonModule,
    FamilyFormComponent,
    FamilyMemberFormModalComponent,
    SacramentEditModalComponent,
    FamilyRelationshipNavigatorComponent,
    FamilyMemberDetailPanelComponent,
    FamilyFinancialDashboardComponent,
    BccTransferModalComponent,
    MarriageHouseholdModalComponent,
    FamilyTransitionHistoryPanelComponent,
    RequestVisitModalComponent
  ],
  templateUrl: './family-detail.html',
  styleUrls: ['./family-detail.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FamilyDetail implements OnInit, OnDestroy {
  private readonly subscriptionAccess = inject(SubscriptionAccessService);

  family: Family | null = null;
  loading = true;
  error: string | null = null;
  showEdit = false;
  sacramentTypesDisplay: SacramentTypeDto[] = [...DEFAULT_SACRAMENT_TYPES];
  expandedMemberIndexes: Set<number> = new Set();
  selectedMemberId: string | null = null;
  searchQuery = '';
  navigatorFilters: NavigatorFilterKey[] = [];
  showMemberModal = false;
  memberModalSaving = false;
  memberModalError: string | null = null;
  memberToEditIndex: number | null = null;
  memberToEdit: FamilyMemberFormValue | null = null;
  editingHeadImage = false;
  headSacramentsExpanded = true;
  isHeadMemberMode = false; // Flag to indicate if we're adding/editing family head
  showSacramentModal = false;
  sacramentModalType: SacramentFormType = 'baptism';
  sacramentModalMember: FamilyMember | null = null;
  sacramentModalMemberIndex: number | null = null;
  homeParishName: string | null = null;
  homeParishAddress: string | null = null;
  homeParishPriest: string | null = null;
  familyFinancialProfile: DonationFamilyFinancialProfile | null = null;
  memberRegisterSacraments: Sacrament[] = [];
  canViewRegisterSacraments = false;
  canRelocateBcc = false;
  canMarriageTransition = false;
  canViewTransitionHistory = false;
  canCreatePastoralVisit = false;
  canViewPastoralCare = false;
  showBccTransferModal = false;
  showMarriageHouseholdModal = false;
  showRequestVisitModal = false;
  pastoralVisits: PastoralCareRequest[] = [];
  workspaceView: FamilyWorkspaceView = 'members';
  readonly workspaceTabs = WORKSPACE_TABS;
  readonly workspaceTabLabels: Record<FamilyWorkspaceView, string> = {
    members: 'Members',
    financial: 'Financial 360°',
    history: 'History'
  };

  get visibleWorkspaceTabs(): FamilyWorkspaceView[] {
    return this.workspaceTabs.filter((tab) => tab !== 'history' || this.canViewTransitionHistory);
  }

  private currentTenant: Tenant | null = null;
  private readonly destroy$ = new Subject<void>();

  get callingCode(): string {
    return this.phoneCodeService.getPhoneCodeSync();
  }

  private guardWrite(action: string): boolean {
    if (!this.subscriptionAccess.isReadOnly()) {
      return true;
    }
    this.toastService.warning(`Read-only mode: renew subscription to ${action}.`, 'Read-only');
    return false;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private familyService: FamilyService,
    private phoneCodeService: PhoneCodeService,
    private toastService: ToastService,
    private store: Store,
    private churchProfileService: ChurchProfileService,
    private sacramentTypeLookup: SacramentTypeLookupService,
    private donationsService: DonationsService,
    private authService: AuthService,
    private sacramentService: SacramentService,
    private pastoralCareService: PastoralCareService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.canViewRegisterSacraments = this.authService.hasPermission('sacraments.view');
    this.canRelocateBcc = this.authService.hasPermission('families.bcc.relocate');
    this.canMarriageTransition = this.authService.hasPermission('families.marriage.transition');
    this.canViewTransitionHistory = this.authService.hasPermission('families.history.view');
    this.canCreatePastoralVisit = this.authService.hasPermission('pastoral.care.create');
    this.canViewPastoralCare = this.authService.canAccessPastoral();
    this.initializeHomeParishContext();
    this.loadSacramentTypes();
    this.initializeWorkspaceView();

    const id = this.route.snapshot.paramMap.get('id') as string;
    if (!id) {
      this.error = 'Family not found';
      this.loading = false;
      return;
    }
    this.loadFamily(id);
    this.loadFamilyFinancialSummary(id);
    this.donationsService.ledgerMutated$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.reloadFamilyFinancialSummary());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Determine the best phone value to display for the family head
   */
  private getHeadPhoneRaw(): string | null {
    const head = this.getFamilyHead();
    const headPhone = head?.phone;
    if (headPhone && String(headPhone).trim()) {
      return String(headPhone).trim();
    }

    return null;
  }

  private initializeHomeParishContext(): void {
    this.store.select(selectCurrentTenant)
      .pipe(takeUntil(this.destroy$))
      .subscribe((tenant) => {
        this.currentTenant = tenant;
        if (tenant) {
          this.homeParishName = tenant.name || this.homeParishName;
          this.homeParishAddress = this.composeTenantAddress(tenant) || this.homeParishAddress;
          this.homeParishPriest = tenant.pastor_name || this.homeParishPriest;
        }
        this.cdr.markForCheck();
      });

    this.churchProfileService.getProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.applyChurchProfileContext(response.data);
          }
          this.cdr.markForCheck();
        },
        error: () => {
          // Optional context; ignore failure
          this.cdr.markForCheck();
        }
      });
  }

  private loadSacramentTypes(): void {
    this.sacramentTypeLookup
      .getSacramentTypes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const types = Array.isArray(response?.data) ? (response.data as SacramentTypeDto[]) : [];
          if (response?.success && types.length > 0) {
            const filtered = [...types]
              .filter(type => type.active !== false)
              .sort((a, b) => {
                const orderA = a.display_order ?? Number.MAX_SAFE_INTEGER;
                const orderB = b.display_order ?? Number.MAX_SAFE_INTEGER;
                if (orderA !== orderB) {
                  return orderA - orderB;
                }
                return (a.name || '').localeCompare(b.name || '');
              });
            this.sacramentTypesDisplay = filtered.length > 0 ? filtered : [...DEFAULT_SACRAMENT_TYPES];
            this.cdr.markForCheck();
            return;
          }
          this.sacramentTypesDisplay = [...DEFAULT_SACRAMENT_TYPES];
          this.cdr.markForCheck();
        },
        error: () => {
          this.sacramentTypesDisplay = [...DEFAULT_SACRAMENT_TYPES];
          this.cdr.markForCheck();
        }
      });
  }

  private applyChurchProfileContext(profile: ChurchProfile): void {
    if (!profile) {
      return;
    }

    if ((profile as any).church_name) {
      this.homeParishName = String((profile as any).church_name);
    }

    if ((profile as any).pastor_name) {
      this.homeParishPriest = String((profile as any).pastor_name);
    }

    if ((profile as any).address) {
      this.homeParishAddress = String((profile as any).address);
    }
  }

  private composeTenantAddress(tenant: Tenant): string | null {
    if (!tenant) {
      return null;
    }
    const addresses = tenant.addresses || [];
    if (!addresses.length) {
      return null;
    }

    const preferred = this.pickPreferredAddress(addresses);
    if (!preferred) {
      return null;
    }

    if (preferred.full_address) {
      return preferred.full_address;
    }

    const segments = [
      preferred.line1,
      preferred.line2,
      preferred.district,
      preferred.city,
      preferred.state_province,
      preferred.country,
      preferred.pin_zip_code
    ].filter(segment => !!segment && String(segment).trim().length > 0);

    return segments.length ? segments.join(', ') : null;
  }

  private pickPreferredAddress(addresses: Address[]): Address | undefined {
    return (
      addresses.find(addr => addr.address_type === 'official') ||
      addresses.find(addr => addr.is_default) ||
      addresses[0]
    );
  }

  /**
   * Get tenant country ISO2 code (e.g., IN, US)
   */
  private getTenantCountryIso2(): string | null {
    const iso2 = this.family?.country?.code;
    if (iso2 && typeof iso2 === 'string' && iso2.trim().length === 2) {
      return iso2.trim().toUpperCase();
    }
    return null;
  }

  /**
   * Get tenant country calling code in +NN format
   */
  private getTenantCallingCode(): string | null {
    const countryPhoneCode = this.family?.country?.phone_code;
    if (countryPhoneCode) {
      const trimmed = String(countryPhoneCode).trim();
      if (trimmed) {
        const digits = trimmed.replace(/\D/g, '');
        if (digits) {
          return trimmed.startsWith('+') ? `+${digits}` : `+${digits}`;
        }
      }
    }

    const iso2 = this.getTenantCountryIso2();
    if (iso2) {
      try {
        const code = getCountryCallingCode(iso2 as CountryCode);
        if (code) {
          return `+${code}`;
        }
      } catch {
        // Ignore library errors and fall through to null
      }
    }

    return null;
  }

  /**
   * Attempt to format the phone number with country code using libphonenumber-js
   */
  private tryFormatPhone(value: string, defaultCountry?: string): string | null {
    const trimmed = value?.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const phoneNumber = defaultCountry
        ? parsePhoneNumber(trimmed, defaultCountry as CountryCode)
        : parsePhoneNumber(trimmed);

      if (phoneNumber && phoneNumber.isValid()) {
        const formatted = phoneNumber.formatInternational();
        return formatted || phoneNumber.number;
      }
    } catch {
      // Parsing failed, fall back to other strategies
    }

    return null;
  }

  /**
   * Public method used in template to display the head phone with calling code
   */
  getHeadPhoneDisplay(): string {
    const rawPhone = this.getHeadPhoneRaw();
    if (!rawPhone) {
      return '-';
    }

    const trimmed = String(rawPhone).trim();
    const tenantIso2 = this.getTenantCountryIso2();
    const tenantCallingCode = this.getTenantCallingCode();

    // Try formatting directly (handles numbers that already include +country code)
    let formatted = this.tryFormatPhone(trimmed);
    if (formatted) {
      return formatted;
    }

    // Try with tenant country ISO (for numbers without explicit country code)
    if (tenantIso2) {
      formatted = this.tryFormatPhone(trimmed, tenantIso2);
      if (formatted) {
        return formatted;
      }
    }

    // Try prepending tenant calling code if missing
    if (!trimmed.startsWith('+') && tenantCallingCode) {
      const digitsOnly = trimmed.replace(/\D/g, '');
      if (digitsOnly) {
        const combined = `${tenantCallingCode}${digitsOnly}`;
        formatted = this.tryFormatPhone(combined);
        if (formatted) {
          return formatted;
        }
      }

      return `${tenantCallingCode} ${trimmed}`.trim();
    }

    // If number already includes +code but couldn't be parsed, try simple split
    if (trimmed.startsWith('+')) {
      const match = trimmed.match(/^(\+\d{1,4})(.*)$/);
      if (match) {
        const code = match[1].trim();
        const rest = match[2].trim();
        return rest ? `${code} ${rest}` : code;
      }
    }

    // Final fallback - return as is
    return trimmed;
  }

  /**
   * Get head email for display
   */
  getHeadEmailDisplay(): string {
    const head = this.getFamilyHead();
    const email = head?.email;
    if (email && String(email).trim()) {
      return String(email).trim();
    }
    return '-';
  }

  loadFamily(id: string): void {
    this.loading = true;
    this.error = null;
    const preferredMemberId =
      this.route.snapshot.queryParamMap.get('member') || this.selectedMemberId;
    this.cdr.markForCheck();

    this.familyService.getFamily(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => this.applyFamilyLoadResponse(res, preferredMemberId, true),
        error: (err) => this.applyFamilyLoadError(err)
      });
  }

  private loadFamilyFinancialSummary(familyId: string): void {
    this.donationsService.getFamilyFinancialProfile(familyId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.familyFinancialProfile = response?.data ?? null;
          this.cdr.detectChanges();
        },
        error: () => {
          this.familyFinancialProfile = null;
          this.cdr.detectChanges();
        }
      });
  }

  reloadFamilyFinancialSummary(): void {
    if (!this.family?.id) {
      return;
    }
    this.loadFamilyFinancialSummary(this.family.id);
  }

  setWorkspaceView(view: FamilyWorkspaceView): void {
    if (this.workspaceView === view) {
      return;
    }

    this.workspaceView = view;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: view === 'members' ? null : view },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    this.cdr.markForCheck();
  }

  workspaceTabId(view: FamilyWorkspaceView): string {
    return `family-workspace-tab-${view}`;
  }

  workspacePanelId(view: FamilyWorkspaceView): string {
    return `family-workspace-panel-${view}`;
  }

  handleWorkspaceTabKeydown(event: KeyboardEvent, view: FamilyWorkspaceView): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.setWorkspaceView(view);
      return;
    }

    const currentIndex = this.workspaceTabs.indexOf(view);
    if (currentIndex === -1) {
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      this.activateWorkspaceTab(this.workspaceTabs[0]);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      this.activateWorkspaceTab(this.workspaceTabs[this.workspaceTabs.length - 1]);
      return;
    }

    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = Math.max(0, Math.min(this.workspaceTabs.length - 1, currentIndex + direction));
    this.activateWorkspaceTab(this.workspaceTabs[nextIndex]);
  }

  private initializeWorkspaceView(): void {
    this.applyWorkspaceViewFromQuery(this.route.snapshot.queryParamMap.get('tab'));

    this.route.queryParamMap
      .pipe(takeUntil(this.destroy$))
      .subscribe((params) => {
        this.applyWorkspaceViewFromQuery(params.get('tab'));
        this.applyMemberFromQuery(params.get('member'));
      });
  }

  private applyMemberFromQuery(memberId: string | null): void {
    if (!memberId || !this.family?.members?.length) {
      return;
    }
    const exists = this.family.members.some((member) => member.id === memberId);
    if (!exists || this.selectedMemberId === memberId) {
      return;
    }
    this.selectedMemberId = memberId;
    this.cdr.markForCheck();
  }

  private applyWorkspaceViewFromQuery(tab: string | null): void {
    const view: FamilyWorkspaceView =
      tab === 'financial' ? 'financial' : tab === 'history' ? 'history' : 'members';
    if (this.workspaceView === view) {
      return;
    }

    this.workspaceView = view;
    this.cdr.markForCheck();
  }

  openBccTransferModal(): void {
    if (!this.guardWrite('transfer BCC')) {
      return;
    }
    if (!this.family || !this.canRelocateBcc) {
      return;
    }
    this.showBccTransferModal = true;
    this.cdr.markForCheck();
  }

  closeBccTransferModal(): void {
    this.showBccTransferModal = false;
    this.cdr.markForCheck();
  }

  onBccTransferCompleted(): void {
    this.showBccTransferModal = false;
    this.toastService.success('Family BCC updated successfully.', 'Success', 4000);
    if (this.family?.id) {
      this.loadFamily(this.family.id);
    }
    this.cdr.markForCheck();
  }

  openRequestVisitModal(): void {
    if (!this.guardWrite('request a visit')) {
      return;
    }
    if (!this.family || !this.canCreatePastoralVisit) {
      return;
    }
    this.showRequestVisitModal = true;
    this.cdr.markForCheck();
  }

  closeRequestVisitModal(): void {
    this.showRequestVisitModal = false;
    this.cdr.markForCheck();
  }

  onRequestVisitCompleted(): void {
    this.showRequestVisitModal = false;
    this.toastService.success('Visit requested.', 'Success', 4000);
    this.loadPastoralVisits();
    this.cdr.markForCheck();
  }

  private loadPastoralVisits(): void {
    if (!this.family?.id || !this.canViewPastoralCare) {
      this.pastoralVisits = [];
      return;
    }
    this.pastoralCareService
      .list({ family_id: this.family.id })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (rows) => {
          this.pastoralVisits = (rows || []).filter((row) => row.status === 'open' || row.status === 'assigned');
          this.cdr.markForCheck();
        },
        error: () => {
          this.pastoralVisits = [];
          this.cdr.markForCheck();
        },
      });
  }

  openMarriageHouseholdModal(): void {
    if (!this.guardWrite('record marriage changes')) {
      return;
    }
    if (!this.family || !this.canMarriageTransition) {
      return;
    }
    this.showMarriageHouseholdModal = true;
    this.cdr.markForCheck();
  }

  closeMarriageHouseholdModal(): void {
    this.showMarriageHouseholdModal = false;
    this.cdr.markForCheck();
  }

  onMarriageHouseholdCompleted(): void {
    this.showMarriageHouseholdModal = false;
    this.toastService.success('Marriage household change recorded.', 'Success', 4000);
    if (this.family?.id) {
      this.loadFamily(this.family.id);
    }
    this.cdr.markForCheck();
  }

  private activateWorkspaceTab(view: FamilyWorkspaceView): void {
    this.setWorkspaceView(view);
    document.getElementById(this.workspaceTabId(view))?.focus();
  }

  /** Refresh family data after member save without hiding the page behind the full-page loader. */
  private reloadFamilyAfterMemberSave(familyId: string, newMemberId?: string | null): void {
    this.familyService.getFamily(familyId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const previousSelectedId = newMemberId || this.selectedMemberId;
          this.applyFamilyLoadResponse(res, previousSelectedId, false);
        },
        error: (err) => {
          console.error('Error refreshing family after member save:', err);
          this.cdr.markForCheck();
        }
      });
  }

  private applyFamilyLoadResponse(
    res: { success?: boolean; data?: Family; message?: string },
    previousSelectedId: string | null,
    fromFullPageLoad: boolean
  ): void {
    if (res.success && res.data) {
      this.error = null;
      this.family = res.data;
      this.headSacramentsExpanded = true;
      this.expandedMemberIndexes.clear();

      const stillExists = previousSelectedId &&
        this.family.members?.some((m) => m.id === previousSelectedId);
      if (stillExists) {
        this.selectedMemberId = previousSelectedId;
      } else {
        this.selectInitialMember();
      }

      if (!this.homeParishName) {
        this.homeParishName = this.currentTenant?.name || this.homeParishName;
      }

      if (!this.homeParishAddress) {
        this.homeParishAddress =
          this.composeTenantAddress(this.currentTenant ?? ({} as Tenant)) || this.homeParishAddress;
      }

      if (!this.homeParishPriest) {
        this.homeParishPriest = this.currentTenant?.pastor_name || this.homeParishPriest;
      }

      this.loadMemberRegisterSacraments();
      this.loadPastoralVisits();
    } else if (fromFullPageLoad) {
      this.family = null;
      this.error = (res.message && res.message.trim().length > 0) ? res.message : 'Failed to load family';
    }

    if (fromFullPageLoad) {
      this.loading = false;
    }
    this.cdr.markForCheck();
  }

  private applyFamilyLoadError(err: { error?: { message?: string } }): void {
    this.family = null;
    const apiMessage = err?.error?.message;
    this.error = (typeof apiMessage === 'string' && apiMessage.trim().length > 0)
      ? apiMessage
      : 'Failed to load family';
    this.loading = false;
    this.cdr.markForCheck();
  }

  openEdit(): void {
    if (!this.guardWrite('edit families')) {
      return;
    }
    this.showEdit = true;
  }

  onEditSave(updated: Family): void {
    this.showEdit = false;
    this.family = updated;
  }

  onEditCancel(): void {
    this.showEdit = false;
  }

  toggleMember(index: number): void {
    const wasExpanded = this.expandedMemberIndexes.has(index);
    
    if (wasExpanded) {
      // Collapsing: scroll to top of member card
      this.expandedMemberIndexes.delete(index);
      // Use setTimeout to ensure DOM updates before scrolling
      setTimeout(() => {
        this.scrollToMemberCardTop(index);
      }, 0);
    } else {
      // Expanding: add to expanded set first
      this.expandedMemberIndexes.add(index);
      // Use setTimeout to wait for Angular change detection and DOM rendering
      setTimeout(() => {
        this.scrollToMemberDetails(index);
      }, 100);
    }
  }

  /**
   * Scroll to the expanded member details section
   */
  private scrollToMemberDetails(index: number): void {
    const detailsElement = document.getElementById(`member-details-${index}`);
    if (detailsElement) {
      detailsElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start',
        inline: 'nearest'
      });
    }
  }

  /**
   * Scroll to the top of the member card
   */
  private scrollToMemberCardTop(index: number): void {
    // Try to find the toggle button first
    const toggleElement = document.getElementById(`member-toggle-${index}`);
    if (toggleElement) {
      toggleElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start',
        inline: 'nearest'
      });
      return;
    }
    
    // Fallback: try to find the member card container by finding any element with the toggle ID pattern
    // Since the details section is removed on collapse, we need to find the card container directly
    const allMemberCards = document.querySelectorAll('.member-card-view');
    allMemberCards.forEach((card) => {
      const toggleBtn = card.querySelector(`[id="member-toggle-${index}"]`);
      if (toggleBtn) {
        (card as HTMLElement).scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start',
          inline: 'nearest'
        });
      }
    });
  }

  isMemberExpanded(index: number): boolean {
    return this.expandedMemberIndexes.has(index);
  }

  toggleHeadSacraments(): void {
    const wasExpanded = this.headSacramentsExpanded;
    
    if (wasExpanded) {
      // Collapsing: scroll to toggle button
      this.headSacramentsExpanded = false;
      // Use setTimeout to ensure DOM updates before scrolling
      setTimeout(() => {
        this.scrollToHeadSacramentsToggle();
      }, 0);
    } else {
      // Expanding: set expanded first
      this.headSacramentsExpanded = true;
      // Use setTimeout to wait for Angular change detection and DOM rendering
      setTimeout(() => {
        this.scrollToHeadSacramentsDetails();
      }, 100);
    }
  }

  /**
   * Scroll to the expanded head sacramental details section
   */
  private scrollToHeadSacramentsDetails(): void {
    // Try to find the main head sacraments section first
    let detailsElement = document.getElementById('head-sacraments');
    
    // If not found, try the fallback section
    if (!detailsElement) {
      detailsElement = document.getElementById('head-sacraments-fallback');
    }
    
    if (detailsElement) {
      detailsElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start',
        inline: 'nearest'
      });
    }
  }

  /**
   * Scroll to the head sacraments toggle button
   */
  private scrollToHeadSacramentsToggle(): void {
    // Try to find the main toggle button first
    let toggleElement = document.getElementById('head-sacraments-toggle');
    
    // If not found, try the fallback toggle button
    if (!toggleElement) {
      toggleElement = document.getElementById('head-sacraments-toggle-fallback');
    }
    
    if (toggleElement) {
      toggleElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start',
        inline: 'nearest'
      });
    }
  }

  /**
   * Normalize name for comparison (remove extra spaces, lowercase)
   */
  private normalizeName(name: string): string {
    return (name || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  /**
   * Get all possible name variations from a member
   */
  private getMemberNameVariations(member: FamilyMember): string[] {
    const variations: string[] = [];
    
    // Check all possible full name fields from API
    const fullNameFields = [
      (member as any).full_name,
      (member as any).full_name_display,
      this.getDisplayName(member)
    ];
    
    fullNameFields.forEach(name => {
      if (name && typeof name === 'string' && name.trim()) {
        variations.push(this.normalizeName(name));
      }
    });
    
    // Also try first + last name combination
    if (member.first_name && member.last_name) {
      const combined = `${member.first_name} ${member.last_name}`.trim();
      if (combined) {
        variations.push(this.normalizeName(combined));
      }
    }
    
    return [...new Set(variations)]; // Remove duplicates
  }

  /**
   * Check if a member's name matches the target name
   */
  private nameMatches(member: FamilyMember, targetName: string): boolean {
    const normalizedTarget = this.normalizeName(targetName);
    if (!normalizedTarget) return false;
    
    const memberVariations = this.getMemberNameVariations(member);
    
    // Exact match
    if (memberVariations.includes(normalizedTarget)) {
      return true;
    }
    
    // Split target and member names into parts for better matching
    const targetParts = normalizedTarget.split(/\s+/).filter(p => p.length > 0);
    
    for (const variation of memberVariations) {
      const variationParts = variation.split(/\s+/).filter(p => p.length > 0);
      
      // If both have at least 2 parts, check last name match first (most reliable)
      if (targetParts.length >= 2 && variationParts.length >= 2) {
        const targetLastName = targetParts[targetParts.length - 1];
        const variationLastName = variationParts[variationParts.length - 1];
        
        // Last names must match
        if (targetLastName === variationLastName) {
          // Check if first name matches (allows for middle names)
          const targetFirstName = targetParts[0];
          const variationFirstName = variationParts[0];
          
          if (targetFirstName === variationFirstName) {
            return true;
          }
          
          // Allow partial first name match (e.g., "Ann" matches "Annamae")
          if (targetFirstName.length >= 3 && variationFirstName.startsWith(targetFirstName)) {
            return true;
          }
          if (variationFirstName.length >= 3 && targetFirstName.startsWith(variationFirstName)) {
            return true;
          }
        }
      }
      
      // Check if target name is fully contained in variation or vice versa
      if (variation.includes(normalizedTarget) || normalizedTarget.includes(variation)) {
        // Additional check: ensure at least one meaningful word matches
        const commonWords = targetParts.filter(word => 
          word.length >= 2 && variationParts.includes(word)
        );
        if (commonWords.length >= 2 || (commonWords.length === 1 && targetParts.length === 1)) {
          return true;
        }
      }
    }
    
    return false;
  }

  getFamilyHead(): FamilyMember | null {
    if (!this.family || !this.family.members || this.family.members.length === 0) {
      return null;
    }
    const candidates = this.family.members;

    // 1) PRIORITY: If database specifies head_of_family on the family record, match it exactly
    const headName = (this.family.head_of_family || '').trim();
    if (headName) {
      // Try exact match first
      let byName = candidates.find(m => {
        const matches = this.nameMatches(m, headName);
        return matches;
      });
      
      if (byName) {
        return byName;
      }
      
      // If no exact match, try fuzzy matching (last name priority)
      const headParts = this.normalizeName(headName).split(/\s+/);
      if (headParts.length >= 2) {
        const headLastName = headParts[headParts.length - 1];
        byName = candidates.find(m => {
          const memberVariations = this.getMemberNameVariations(m);
          const found = memberVariations.some(v => {
            const parts = v.split(/\s+/);
            const lastMatch = parts.length >= 2 && parts[parts.length - 1] === headLastName;
            // Also check first name matches
            const firstMatch = parts.length >= 1 && parts[0] === headParts[0];
            return lastMatch && (firstMatch || headParts.length === 1);
          });
          return found;
        });
        if (byName) {
          return byName;
        }
      }
      
      // If head_of_family is specified but we can't match any member, return null
      // The template will use the fallback to show the head_of_family string
      return null;
    }

    // 2) Prefer explicit self/head relationships (prioritize active members)
    const relPriority = ['self', 'head', 'head of family'];
    const byRelationship = candidates.find(m => {
      const rel = String(m.relationship_to_head || '').toLowerCase();
      return relPriority.includes(rel) && m.status === 'active';
    }) || candidates.find(m => {
      const rel = String(m.relationship_to_head || '').toLowerCase();
      return relPriority.includes(rel);
    }) || candidates.find(m => {
      const isPrimary = (m as any).is_primary_contact === true && m.status === 'active';
      return isPrimary;
    }) || candidates.find(m => {
      const isPrimary = (m as any).is_primary_contact === true;
      return isPrimary;
    });
    if (byRelationship) {
      return byRelationship;
    }

    // 3) Fallback: first active member, else first member
    return candidates.find(m => m.status === 'active') || candidates[0] || null;
  }

  getDisplayName(member: FamilyMember | null | undefined): string {
    if (!member) {
      return '—';
    }
    // Check API-returned fields in priority order
    const fullNameFields = [
      (member as any).full_name_display,
      (member as any).full_name,
      (member as any).fullName
    ];
    
    for (const full of fullNameFields) {
      if (typeof full === 'string' && full.trim().length > 0) {
        return full.trim();
      }
    }
    
    // Build from parts
    const parts = [member.first_name, (member as any).middle_name, member.last_name]
      .filter((p: string | undefined) => !!p && String(p).trim().length > 0)
      .map((p: string) => p.trim());
    const name = parts.join(' ').replace(/\s+/g, ' ').trim();
    return name || '—';
  }

  /**
   * Format date for display
   */
  formatDate(date: string | null | undefined): string {
    if (!date) return '—';
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) return '—';
      return dateObj.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return '—';
    }
  }

  /**
   * Format gender for display
   */
  formatGender(gender: string | null | undefined): string {
    if (!gender) return '—';
    const genderStr = String(gender).toLowerCase();
    switch (genderStr) {
      case 'male': return 'Male';
      case 'female': return 'Female';
      case 'other': return 'Other';
      default: return gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();
    }
  }

  /**
   * Format marital status for display
   */
  formatMaritalStatus(status: string | null | undefined): string {
    if (!status) return '—';
    const statusStr = String(status).toLowerCase();
    switch (statusStr) {
      case 'single': return 'Single';
      case 'married': return 'Married';
      case 'widowed': return 'Widowed';
      case 'separated': return 'Separated';
      case 'divorced': return 'Divorced';
      default: return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    }
  }

  /**
   * Format sacrament date for display
   */
  formatSacramentDate(date: string | null | undefined): string {
    if (!date) return '—';
    return this.formatDate(date);
  }

  /**
   * Count completed sacraments for a member
   */
  countCompletedSacraments(member: FamilyMember | null | undefined): number {
    if (!member || this.sacramentTypesDisplay.length === 0) {
      return 0;
    }
    return this.sacramentTypesDisplay.reduce((count, type) => {
      return this.isSacramentCompleted(member, type.code) ? count + 1 : count;
    }, 0);
  }

  trackSacramentType(index: number, type: SacramentTypeDto): number | string {
    return type.id ?? type.code ?? index;
  }

  isSacramentEditable(code: string): boolean {
    return this.resolveCanonicalSacrament(code) !== null;
  }

  getCanonicalSacrament(code: string): SacramentFormType | null {
    return this.resolveCanonicalSacrament(code);
  }

  isSacramentCompleted(member: FamilyMember | null | undefined, code: string): boolean {
    return sacramentCompleted(member, code);
  }

  private resolveCanonicalSacrament(code: string): SacramentFormType | null {
    return resolveSacrament(code);
  }

  selectInitialMember(): void {
    const head = this.getFamilyHead();
    if (head?.id) {
      this.selectedMemberId = head.id;
      return;
    }
    const first = this.family?.members?.[0];
    this.selectedMemberId = first?.id ?? null;
  }

  getHeadMemberId(): string | null {
    return this.getFamilyHead()?.id ?? null;
  }

  getSelectedMemberIndex(): number | null {
    if (!this.selectedMemberId || !this.family?.members) {
      return null;
    }
    const idx = this.family.members.findIndex((m) => m.id === this.selectedMemberId);
    return idx >= 0 ? idx : null;
  }

  isSelectedMemberHead(): boolean {
    const idx = this.getSelectedMemberIndex();
    return idx !== null && this.isHeadMember(idx);
  }

  showHeadWithoutMemberPanel(): boolean {
    return !!this.family?.head_of_family && !this.getFamilyHead();
  }

  onNavigatorSelectMember(index: number): void {
    const member = this.family?.members?.[index];
    if (member?.id) {
      this.selectedMemberId = member.id;
      this.loadMemberRegisterSacraments();
      this.cdr.markForCheck();
    }
  }

  private loadMemberRegisterSacraments(): void {
    if (!this.canViewRegisterSacraments) {
      this.memberRegisterSacraments = [];
      return;
    }

    const member = this.getSelectedMember();
    if (!member?.id) {
      this.memberRegisterSacraments = [];
      return;
    }

    this.sacramentService
      .getSacraments({
        family_member_id: member.id,
        per_page: 50,
        sort_by: 'date_administered',
        sort_dir: 'desc'
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const paginated = response?.data;
          this.memberRegisterSacraments = Array.isArray(paginated?.data) ? paginated.data : [];
          this.cdr.markForCheck();
        },
        error: () => {
          this.memberRegisterSacraments = [];
          this.cdr.markForCheck();
        }
      });
  }

  private getSelectedMember(): FamilyMember | null {
    const index = this.getSelectedMemberIndex();
    if (index === null || !this.family?.members?.[index]) {
      return null;
    }
    return this.family.members[index];
  }

  onNavigatorSearchChange(query: string): void {
    this.searchQuery = query;
    this.cdr.markForCheck();
  }

  onNavigatorFilterToggle(key: NavigatorFilterKey): void {
    const idx = this.navigatorFilters.indexOf(key);
    if (idx >= 0) {
      this.navigatorFilters = this.navigatorFilters.filter((f) => f !== key);
    } else {
      this.navigatorFilters = [...this.navigatorFilters, key];
    }
    this.cdr.markForCheck();
  }

  onNavigatorAddMember(): void {
    if (!this.guardWrite('add members')) {
      return;
    }
    this.memberToEditIndex = null;
    this.memberToEdit = null;
    this.isHeadMemberMode = false;
    this.memberModalError = null;
    this.memberModalSaving = false;
    this.showMemberModal = true;
  }

  onPanelSacramentModal(event: { index: number; code: string }): void {
    this.openSacramentModal(event.index, event.code);
  }

  onPanelHeadSacramentModal(code: string): void {
    this.openHeadSacramentModal(code);
  }

  openSacramentModal(memberIndex: number, sacrament: string, event?: Event): void {
    event?.stopPropagation();
    if (!this.guardWrite('update sacraments')) {
      return;
    }

    const modalSacrament = this.resolveCanonicalSacrament(sacrament);
    if (!modalSacrament) {
      return;
    }

    if (!this.family?.members || !this.family.id) {
      this.toastService.error('Family data not ready. Please refresh and try again.', 'Error', 5000);
      return;
    }

    const member = this.family.members[memberIndex];
    if (!member) {
      this.toastService.error('Unable to locate member details.', 'Error', 5000);
      return;
    }

    this.sacramentModalMemberIndex = memberIndex;
    this.sacramentModalMember = member;
    this.sacramentModalType = modalSacrament;
    this.showSacramentModal = true;
  }

  openHeadSacramentModal(sacrament: string, event?: Event): void {
    event?.stopPropagation();

    const canonical = this.resolveCanonicalSacrament(sacrament);
    if (!canonical) {
      return;
    }

    const headIndex = this.getFamilyHeadIndex();
    if (headIndex === null) {
      this.toastService.error('Family head not found among members.', 'Error', 4000);
      return;
    }

    this.openSacramentModal(headIndex, canonical);
  }

  closeSacramentModal(): void {
    this.showSacramentModal = false;
    this.sacramentModalMember = null;
    this.sacramentModalMemberIndex = null;
  }

  onSacramentSaved(updatedMember: FamilyMember): void {
    if (!this.family?.members || !updatedMember) {
      this.closeSacramentModal();
      return;
    }

    const targetId = this.normalizeMemberId(updatedMember.id ?? this.sacramentModalMember?.id);
    let index = targetId
      ? this.family.members.findIndex(m => this.normalizeMemberId(m.id) === targetId)
      : -1;

    if (index < 0 && this.sacramentModalMemberIndex !== null && this.sacramentModalMemberIndex >= 0) {
      index = this.sacramentModalMemberIndex;
    }

    if (index >= 0 && index < this.family.members.length) {
      const mergedMember: FamilyMember = {
        ...this.family.members[index],
        ...updatedMember
      };

      const updatedMembers = [...this.family.members];
      updatedMembers[index] = mergedMember;

      this.family = {
        ...this.family,
        members: updatedMembers
      };

      if (this.sacramentModalMemberIndex === index) {
        this.sacramentModalMember = mergedMember;
      }

      this.cdr.markForCheck();
    }

    this.toastService.success('Sacramental details updated successfully.', 'Success', 4000);
    this.closeSacramentModal();

    if (this.family?.id) {
      this.loadFamily(String(this.family.id));
    }
  }

  private normalizeMemberId(id: unknown): string | null {
    if (id === null || id === undefined) {
      return null;
    }

    const normalized = String(id).trim();
    return normalized.length ? normalized : null;
  }

  /**
   * Get formatted family address (family head's address)
   */
  getFamilyAddress(): string | null {
    if (!this.family) {
      return null;
    }

    const addressParts: string[] = [];

    // Address line 1
    if (this.family.address_line_1) {
      addressParts.push(this.family.address_line_1.trim());
    }

    // Address line 2
    if (this.family.address_line_2) {
      addressParts.push(this.family.address_line_2.trim());
    }

    // City
    if (this.family.city) {
      addressParts.push(this.family.city.trim());
    }

    // State (if available)
    if (this.family.state?.name) {
      addressParts.push(this.family.state.name.trim());
    }

    // Postal code
    if (this.family.postal_code) {
      addressParts.push(this.family.postal_code.trim());
    }

    // Country (if available)
    if (this.family.country?.name) {
      addressParts.push(this.family.country.name.trim());
    }

    // If we have any address parts, join them with commas and return
    if (addressParts.length > 0) {
      return addressParts.join(', ');
    }

    return null;
  }

  /**
   * Get the index of the family head member in the members array
   */
  getFamilyHeadIndex(): number | null {
    if (!this.family || !this.family.members || this.family.members.length === 0) {
      return null;
    }
    
    const head = this.getFamilyHead();
    if (!head || !head.id) {
      return null;
    }
    
    // Find the index of the head member by matching ID
    const index = this.family.members.findIndex(m => m.id === head.id);
    return index >= 0 ? index : null;
  }

  /**
   * Check if a member at the given index is the family head
   */
  isHeadMember(index: number): boolean {
    const headIndex = this.getFamilyHeadIndex();
    return headIndex !== null && headIndex === index;
  }

  getRegularMemberIndices(): number[] {
    if (!this.family || !this.family.members) {
      return [];
    }
    const indices: number[] = [];
    this.family.members.forEach((_, idx) => {
      if (!this.isHeadMember(idx)) {
        indices.push(idx);
      }
    });
    return indices;
  }

  get regularMembersCount(): number {
    return this.getRegularMemberIndices().length;
  }

  /**
   * Open edit modal for the family head member
   */
  openEditHeadMember(): void {
    const headIndex = this.getFamilyHeadIndex();
    if (headIndex !== null) {
      this.openEditMember(headIndex);
    } else {
      // If head is not found in members, show error
      this.toastService.error('Family head member not found in members list. Please add the head as a member first.', 'Error', 5000);
    }
  }

  /**
   * Open add or edit family head member modal
   * This method handles both adding a new head and editing an existing head
   */
  openAddOrEditHeadMember(): void {
    if (!this.guardWrite('edit members')) {
      return;
    }
    const head = this.getFamilyHead();
    this.isHeadMemberMode = true; // Set flag to lock relationship dropdown
    
    if (head && head.id) {
      // Edit existing head member
      const headIndex = this.getFamilyHeadIndex();
      if (headIndex !== null) {
        this.memberToEditIndex = headIndex;
        this.memberToEdit = this.getMemberFormValue(headIndex);
        // Ensure relationship is set to 'self' for head
        if (this.memberToEdit) {
          this.memberToEdit.relationship_to_head = 'self';
        }
      } else {
        // Head exists but not in members array - create form value from head data
        this.memberToEditIndex = null; // Will be treated as new member
        this.memberToEdit = {
          id: head.id,
          first_name: head.first_name || '',
          middle_name: head.middle_name || '',
          last_name: head.last_name || '',
          date_of_birth: head.date_of_birth || '',
          gender: head.gender || '',
          relationship_to_head: 'self', // Always 'self' for head
          marital_status: head.marital_status || 'single',
          phone: head.phone || '',
          email: head.email || '',
          occupation: head.occupation || '',
          education: head.education || '',
          baptism_date: head.baptism_date || '',
          first_communion_date: head.first_communion_date || '',
          confirmation_date: head.confirmation_date || '',
          status: head.status || 'active'
        };
      }
    } else {
      // Add new head member - create empty form value
      this.memberToEditIndex = null;
      // Parse head_of_family name if available
      let firstName = '';
      let lastName = '';
      if (this.family?.head_of_family) {
        const nameParts = this.family.head_of_family.trim().split(/\s+/).filter(p => p.trim().length > 0);
        if (nameParts.length === 1) {
          firstName = nameParts[0];
        } else if (nameParts.length >= 2) {
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(' ');
        }
      }
      
      this.memberToEdit = {
        id: null,
        first_name: firstName,
        middle_name: '',
        last_name: lastName,
        date_of_birth: '',
        gender: '',
        relationship_to_head: 'self', // Always 'self' for head
        marital_status: 'single',
        phone: '',
        email: '',
        occupation: '',
        education: '',
        baptism_date: '',
        first_communion_date: '',
        confirmation_date: '',
        status: 'active'
      };
    }
    
    this.memberModalError = null;
    this.memberModalSaving = false;
    this.showMemberModal = true;
  }

  openEditMember(index: number): void {
    if (!this.guardWrite('edit members')) {
      return;
    }
    this.memberToEditIndex = index;
    this.isHeadMemberMode = false; // Regular member edit, not head mode
    // Store the member data once when opening the modal to prevent re-patching the form
    // This ensures the form only gets the initial data and user changes are preserved
    this.memberToEdit = this.getMemberFormValue(index);
    this.memberModalError = null;
    this.memberModalSaving = false;
    this.showMemberModal = true;
  }

  getMemberFormValue(index: number): FamilyMemberFormValue | null {
    if (!this.family || !this.family.members || !this.family.members[index]) {
      return null;
    }
    const m = this.family.members[index];
    return {
      // CRITICAL: Keep ID as string (UUID), don't convert to Number
      id: m.id ? String(m.id).trim() : null,
      first_name: m.first_name || '',
      middle_name: m.middle_name || '',
      last_name: m.last_name || '',
      date_of_birth: m.date_of_birth || '',
      gender: m.gender || '',
      relationship_to_head: m.relationship_to_head || 'other',
      marital_status: m.marital_status || 'single',
      phone: m.phone || '',
      email: m.email || '',
      occupation: m.occupation || '',
      education: m.education || '',
      baptism_date: m.baptism_date || '',
      first_communion_date: m.first_communion_date || '',
      confirmation_date: m.confirmation_date || '',
      status: m.status || 'active'
    };
  }

  onMemberModalSave(value: FamilyMemberFormValue): void {
    if (!this.guardWrite('save members')) {
      return;
    }
    this.memberModalError = null;

    // CRITICAL: If this is head member mode, ensure relationship is always 'self'
    if (this.isHeadMemberMode) {
      value.relationship_to_head = 'self';
    }
    
    // If memberToEditIndex is null, this is a new member (add mode)
    if (this.memberToEditIndex === null) {
      if (!this.family?.id) {
        this.memberModalError = 'Family not loaded. Please refresh and try again.';
        return;
      }

      const familyId = String(this.family.id).trim();
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(familyId)) {
        this.memberModalError = 'Invalid family ID format. Please refresh and try again.';
        return;
      }

      const payload = prepareFamilyMemberPayload(value, this.callingCode);
      this.memberModalSaving = true;

      this.familyService.addFamilyMember(familyId, payload)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (res) => {
            this.memberModalSaving = false;
            if (isMemberApiSuccess(res)) {
              const savedMember = getMemberApiData<FamilyMember>(res);
              this.finishMemberModalSuccess(
                getMemberApiMessage(res, 'Member added successfully'),
                familyId,
                savedMember?.id ?? null
              );
            } else {
              this.memberModalError = getMemberApiMessage(res, 'Failed to add member');
              this.cdr.markForCheck();
            }
          },
          error: (err) => {
            console.error('Error adding family member:', err);
            this.memberModalSaving = false;
            this.memberModalError = extractMemberApiError(err, 'Failed to add member');
            this.cdr.markForCheck();
          }
        });
      return;
    }
    
    // Editing existing member
    if (!this.family || !this.family.members) {
      this.toastService.error('Family not loaded. Please refresh and try again.', 'Error', 5000);
      return;
    }
    
    const member = this.family.members[this.memberToEditIndex];
    if (!member || !member.id) {
      this.toastService.error('Member ID not found. Please refresh and try again.', 'Error', 5000);
      console.error('Member update failed - member or member.id is missing:', {
        member,
        memberToEditIndex: this.memberToEditIndex,
        familyMembers: this.family.members
      });
      return;
    }
    
    // CRITICAL: Validate member ID is a valid UUID string
    const memberId = String(member.id || '').trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(memberId)) {
      this.toastService.error('Invalid member ID format. Please refresh and try again.', 'Error', 5000);
      console.error('Invalid member ID format:', memberId);
      return;
    }
    
    const payload = prepareFamilyMemberPayload(value, this.callingCode);
    this.memberModalSaving = true;
    
    // Ensure family_id is properly converted to string and trimmed
    const familyId = String(this.family.id || '').trim();
    
    // Validate that IDs are not empty after trimming
    if (!familyId || !memberId) {
      this.toastService.error('Invalid family or member ID. Please refresh and try again.', 'Error', 5000);
      return;
    }
    
    // Validate family ID is also a UUID
    if (!uuidRegex.test(familyId)) {
      this.toastService.error('Invalid family ID format. Please refresh and try again.', 'Error', 5000);
      console.error('Invalid family ID format:', familyId);
      return;
    }
    
    console.log('Updating family member:', {
      familyId,
      memberId,
      memberName: `${member.first_name} ${member.last_name}`,
      payloadKeys: Object.keys(payload),
      payloadStatus: payload['status']
    });
    
    this.familyService.updateFamilyMember(familyId, memberId, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.memberModalSaving = false;
          if (isMemberApiSuccess(res)) {
            const savedMember = getMemberApiData<FamilyMember>(res);
            this.finishMemberModalSuccess(
              getMemberApiMessage(res, 'Member updated successfully'),
              familyId,
              savedMember?.id ?? memberId
            );
          } else {
            this.memberModalError = getMemberApiMessage(res, 'Failed to update member');
            this.cdr.markForCheck();
          }
        },
        error: (err) => {
          console.error('Error updating family member:', err);
          this.memberModalSaving = false;
          this.memberModalError = extractMemberApiError(err, 'Failed to update member');
          this.cdr.markForCheck();
        }
      });
  }

  onMemberModalCancel(): void {
    this.closeMemberModal();
  }

  private finishMemberModalSuccess(message: string, familyId: string, selectMemberId?: string | null): void {
    this.closeMemberModal();
    this.toastService.success(message, 'Success', 4000);
    this.reloadFamilyAfterMemberSave(familyId, selectMemberId ?? null);
  }

  private closeMemberModal(): void {
    this.showMemberModal = false;
    this.memberToEditIndex = null;
    this.memberToEdit = null;
    this.isHeadMemberMode = false;
    this.memberModalError = null;
    this.memberModalSaving = false;
    this.cdr.markForCheck();
  }

  // ==================== FAMILY PROFILE IMAGE OPERATIONS ====================

  /**
   * Handle profile image file selection
   */
  onProfileImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0 && this.family?.id) {
      const file = input.files[0];
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        this.toastService.error('Please select a valid image file (JPEG, PNG, GIF, or WebP)', 'Error', 5000);
        input.value = '';
        return;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        this.toastService.error('File size must be less than 5MB', 'Error', 5000);
        input.value = '';
        return;
      }

      // Upload the file
      this.uploadProfileImage(file);
      input.value = ''; // Reset input
    }
  }

  /**
   * Upload family profile image
   */
  uploadProfileImage(file: File): void {
    if (!this.guardWrite('upload images')) {
      return;
    }
    if (!this.family?.id) {
      this.toastService.error('Family not loaded. Please refresh and try again.', 'Error', 5000);
      return;
    }

    this.familyService.uploadProfileImage(this.family.id, file)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.family = res.data;
            this.toastService.success('Profile image uploaded successfully', 'Success', 4000);
          } else {
            this.toastService.error(res.message || 'Failed to upload image', 'Error', 5000);
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error uploading profile image:', err);
          let errorMessage = 'Failed to upload image';
          
          if (err?.error) {
            if (err.error.errors) {
              const validationErrors = Object.values(err.error.errors).flat();
              errorMessage = validationErrors.join(', ') || errorMessage;
            } else if (err.error.message) {
              errorMessage = err.error.message;
            }
          }
          
          this.toastService.error(errorMessage, 'Error', 6000);
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Delete family profile image
   */
  deleteProfileImage(): void {
    if (!this.guardWrite('delete images')) {
      return;
    }
    if (!this.family?.id) {
      this.toastService.error('Family not loaded. Please refresh and try again.', 'Error', 5000);
      return;
    }

    if (!confirm('Are you sure you want to delete the family profile image?')) {
      return;
    }

    this.familyService.deleteProfileImage(this.family.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success) {
            // Update family to remove profile image URL
            if (this.family) {
              this.family.profile_image_url = undefined;
              this.family.profile_image_full_url = undefined;
            }
            this.toastService.success('Profile image deleted successfully', 'Success', 4000);
          } else {
            this.toastService.error(res.message || 'Failed to delete image', 'Error', 5000);
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error deleting profile image:', err);
          this.toastService.error('Failed to delete image', 'Error', 6000);
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Trigger file input click
   */
  triggerProfileImageInput(): void {
    const input = document.getElementById('profileImageInput') as HTMLInputElement;
    if (input) {
      input.click();
    }
  }

  // ==================== FAMILY HEAD PROFILE IMAGE OPERATIONS ====================

  /**
   * Handle head profile image file selection
   */
  onHeadProfileImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0 && this.family?.id) {
      const file = input.files[0];
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        this.toastService.error('Please select a valid image file (JPEG, PNG, GIF, or WebP)', 'Error', 5000);
        input.value = '';
        return;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        this.toastService.error('File size must be less than 5MB', 'Error', 5000);
        input.value = '';
        return;
      }

      // Upload the file
      this.uploadHeadProfileImage(file);
      input.value = ''; // Reset input
    }
  }

  /**
   * Upload family head profile image
   */
  uploadHeadProfileImage(file: File): void {
    if (!this.guardWrite('upload images')) {
      return;
    }
    if (!this.family?.id) {
      this.toastService.error('Family not loaded. Please refresh and try again.', 'Error', 5000);
      return;
    }

    this.familyService.uploadHeadProfileImage(this.family.id, file)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.family = res.data;
            this.editingHeadImage = false; // Close editing mode
            this.toastService.success('Head profile image uploaded successfully', 'Success', 4000);
          } else {
            this.toastService.error(res.message || 'Failed to upload image', 'Error', 5000);
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error uploading head profile image:', err);
          let errorMessage = 'Failed to upload image';
          
          if (err?.error) {
            if (err.error.errors) {
              const validationErrors = Object.values(err.error.errors).flat();
              errorMessage = validationErrors.join(', ') || errorMessage;
            } else if (err.error.message) {
              errorMessage = err.error.message;
            }
          }
          
          this.toastService.error(errorMessage, 'Error', 6000);
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Delete family head profile image
   */
  deleteHeadProfileImage(): void {
    if (!this.guardWrite('delete images')) {
      return;
    }
    if (!this.family?.id) {
      this.toastService.error('Family not loaded. Please refresh and try again.', 'Error', 5000);
      return;
    }

    if (!confirm('Are you sure you want to delete the family head profile image?')) {
      return;
    }

    this.familyService.deleteHeadProfileImage(this.family.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success) {
            // Update family to remove profile image URL
            if (this.family) {
              this.family.head_profile_image_url = undefined;
              this.family.head_profile_image_full_url = undefined;
            }
            this.editingHeadImage = false; // Close editing mode
            this.toastService.success('Head profile image deleted successfully', 'Success', 4000);
          } else {
            this.toastService.error(res.message || 'Failed to delete image', 'Error', 5000);
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error deleting head profile image:', err);
          this.toastService.error('Failed to delete image', 'Error', 6000);
          this.cdr.markForCheck();
        }
      });
  }

  /**
   * Trigger head profile image input click
   */
  triggerHeadProfileImageInput(): void {
    console.log('triggerHeadProfileImageInput called');
    const input = document.getElementById('headProfileImageInput') as HTMLInputElement;
    if (input) {
      console.log('Found headProfileImageInput, clicking...');
      input.click();
    } else {
      console.log('headProfileImageInput not found, trying derived...');
      const derivedInput = document.getElementById('headProfileImageInputDerived') as HTMLInputElement;
      if (derivedInput) {
        console.log('Found headProfileImageInputDerived, clicking...');
        derivedInput.click();
      } else {
        console.error('Neither head profile image input found!');
      }
    }
  }
}
