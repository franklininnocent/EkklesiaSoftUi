import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { BishopService } from '@core/services/ecclesiastical';
import { Bishop } from '@core/models/ecclesiastical';
import { ToastService } from '@core/services';
import { AuthService } from '@core/services/auth.service';
import { LoadingSkeletonComponent } from '@shared/components/loading-skeleton/loading-skeleton.component';
import { ConfirmationModalComponent } from '@shared/components/confirmation-modal/confirmation-modal.component';
import { PageHeaderComponent } from '@shared/components/page-header/page-header.component';
import { TabStripComponent, TabStripItem } from '@shared/components/tab-strip/tab-strip.component';
import { StatusBadgeTone } from '@shared/components/status-badge/status-badge.component';
import { BishopAppointmentsTabComponent } from '../bishop-appointments-tab/bishop-appointments-tab.component';
import { BishopAuditTabComponent } from '../bishop-audit-tab/bishop-audit-tab.component';
import { BishopFormModalComponent } from '../bishop-form-modal/bishop-form-modal.component';
import { BishopAvatarComponent } from '@shared/components/bishop-avatar/bishop-avatar.component';
import { resolveBishopPhotoUrl } from '@core/utils/bishop-photo.util';

type BishopDetailTab = 'person' | 'appointments' | 'audit';

@Component({
  selector: 'app-bishop-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    LoadingSkeletonComponent,
    ConfirmationModalComponent,
    PageHeaderComponent,
    TabStripComponent,
    BishopAppointmentsTabComponent,
    BishopAuditTabComponent,
    BishopFormModalComponent,
    BishopAvatarComponent,
  ],
  templateUrl: './bishop-detail.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './bishop-detail.component.scss'
})
export class BishopDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly bishopService = inject(BishopService);
  private readonly toastService = inject(ToastService);
  private readonly auth = inject(AuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  bishop: Bishop | null = null;
  loading = true;
  showDeleteModal = false;
  showFormModal = false;
  activeTab: BishopDetailTab = 'person';
  uploadingPhoto = false;
  canManageImages = false;

  readonly tabItems: TabStripItem[] = [
    { id: 'person', label: 'Person', domId: 'bishop-tab-person', ariaControls: 'bishop-panel-person' },
    { id: 'appointments', label: 'Appointments', domId: 'bishop-tab-appointments', ariaControls: 'bishop-panel-appointments' },
    { id: 'audit', label: 'Audit', domId: 'bishop-tab-audit', ariaControls: 'bishop-panel-audit' },
  ];

  get bishopStatusTone(): StatusBadgeTone {
    switch ((this.bishop?.status || '').toLowerCase()) {
      case 'active': return 'success';
      case 'retired': return 'warning';
      case 'deceased': return 'critical';
      default: return 'neutral';
    }
  }

  get bishopPhotoUrl(): string | null {
    return resolveBishopPhotoUrl(this.bishop);
  }

  ngOnInit(): void {
    this.canManageImages = this.auth.hasEcclesiasticalPermission('bishops.manage_images');
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) this.loadBishop(id);
    });
    this.route.queryParamMap.subscribe((query) => {
      const tab = query.get('tab') as BishopDetailTab | null;
      if (tab && ['person', 'appointments', 'audit'].includes(tab)) {
        this.activeTab = tab;
        this.cdr.markForCheck();
      }
    });
  }

  loadBishop(id: string): void {
    this.loading = true;
    this.bishopService.getBishop(parseInt(id, 10)).subscribe({
      next: (response) => {
        this.bishop = response.data;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.toastService.error('Failed to load bishop details');
        this.loading = false;
        this.router.navigate(['/settings/ecclesiastical/bishops']);
      }
    });
  }

  onTabChange(tab: string): void {
    this.activeTab = tab as BishopDetailTab;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }

  onEdit(): void {
    this.showFormModal = true;
  }

  onFormSaved(): void {
    this.showFormModal = false;
    if (this.bishop) this.loadBishop(String(this.bishop.id));
  }

  onDelete(): void {
    this.showDeleteModal = true;
  }

  confirmDelete(): void {
    if (!this.bishop) return;
    this.bishopService.deleteBishop(this.bishop.id).subscribe({
      next: () => {
        this.toastService.success('Bishop deleted successfully');
        this.router.navigate(['/settings/ecclesiastical/bishops']);
      },
      error: () => {
        this.toastService.error('Failed to delete bishop');
        this.showDeleteModal = false;
        this.cdr.markForCheck();
      }
    });
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
  }

  viewDiocese(dioceseId: number | string): void {
    this.router.navigate(['/settings/ecclesiastical/dioceses', dioceseId.toString()]);
  }

  onPhotoSelected(event: Event): void {
    if (!this.bishop || !this.canManageImages) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploadingPhoto = true;
    this.bishopService.uploadPhoto(this.bishop.id, file).subscribe({
      next: (res) => {
        if (this.bishop && res.data) {
          this.bishop.photo_public_url = res.data.photo_public_url;
          this.bishop.photo_path = res.data.photo_path;
          this.bishop.photo_url = res.data.photo_url ?? this.bishop.photo_url;
          this.bishop.has_photo = res.data.has_photo ?? true;
        }
        this.uploadingPhoto = false;
        this.toastService.success('Photo uploaded');
        this.cdr.markForCheck();
      },
      error: () => {
        this.uploadingPhoto = false;
        this.toastService.error('Unable to upload Bishop photo. Please select a valid image and try again.');
        this.cdr.markForCheck();
      },
    });
  }

  onRemovePhoto(): void {
    if (!this.bishop || !this.canManageImages) return;
    this.uploadingPhoto = true;
    this.bishopService.deletePhoto(this.bishop.id).subscribe({
      next: () => {
        if (this.bishop) {
          this.bishop.photo_public_url = undefined;
          this.bishop.photo_path = undefined;
          this.bishop.photo_url = undefined;
          this.bishop.has_photo = false;
        }
        this.uploadingPhoto = false;
        this.toastService.success('Photo removed');
        this.cdr.markForCheck();
      },
      error: () => {
        this.uploadingPhoto = false;
        this.toastService.error('Failed to remove photo');
        this.cdr.markForCheck();
      },
    });
  }

  formatDate(date: string | null | undefined): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  getStatusBadgeClass(status: string): string {
    const statusMap: Record<string, string> = {
      active: 'badge-active',
      retired: 'badge-retired',
      deceased: 'badge-deceased',
      inactive: 'badge-inactive',
    };
    return statusMap[status?.toLowerCase()] || 'badge-inactive';
  }

  getInitials(name: string): string {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  }

  calculateAge(birthDate: string | null | undefined): string {
    if (!birthDate) return 'N/A';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
    return `${age} years`;
  }

  calculateYearsOfService(ordinationDate: string | null | undefined): string {
    if (!ordinationDate) return 'N/A';
    const years = new Date().getFullYear() - new Date(ordinationDate).getFullYear();
    return `${years} years`;
  }

  titleName(): string | undefined {
    const t = this.bishop?.ecclesiastical_title;
    return t?.name || t?.title;
  }
}
