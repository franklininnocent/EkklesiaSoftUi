import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FamilyService } from '../../../../core/services/family.service';
import { Family, FamilyMember } from '../../../../core/models/family.model';
import { FamilyFormComponent } from '../family-form/family-form';
import { FamilyMemberFormModalComponent, FamilyMemberFormValue } from '../family-member-form-modal/family-member-form-modal.component';

@Component({
  selector: 'app-family-detail',
  standalone: true,
  imports: [CommonModule, FamilyFormComponent, FamilyMemberFormModalComponent],
  templateUrl: './family-detail.html',
  styleUrls: ['./family-detail.scss'],
})
export class FamilyDetail implements OnInit {
  family: Family | null = null;
  loading = true;
  error: string | null = null;
  showEdit = false;
  expandedMemberIndexes: Set<number> = new Set();
  showMemberModal = false;
  memberToEditIndex: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private familyService: FamilyService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') as string;
    if (!id) {
      this.error = 'Family not found';
      this.loading = false;
      return;
    }
    this.loadFamily(id);
  }

  loadFamily(id: string): void {
    this.loading = true;
    this.familyService.getFamily(id).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.family = res.data;
          this.loading = false;
        } else {
          this.error = res.message || 'Failed to load family';
          this.loading = false;
        }
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to load family';
        this.loading = false;
      }
    });
  }

  openEdit(): void {
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
    if (this.expandedMemberIndexes.has(index)) {
      this.expandedMemberIndexes.delete(index);
    } else {
      this.expandedMemberIndexes.add(index);
    }
  }

  isMemberExpanded(index: number): boolean {
    return this.expandedMemberIndexes.has(index);
  }

  getFamilyHead(): FamilyMember | null {
    if (!this.family || !this.family.members) {
      return null;
    }
    return this.family.members.find(m => m.relationship_to_head === 'self') || null;
  }

  getDisplayName(member: FamilyMember | null | undefined): string {
    if (!member) {
      return '—';
    }
    const full = (member as any).full_name;
    if (typeof full === 'string' && full.trim().length > 0) {
      return full.trim();
    }
    const parts = [member.first_name, (member as any).middle_name, member.last_name]
      .filter((p: string | undefined) => !!p && String(p).trim().length > 0)
      .map((p: string) => p.trim());
    const name = parts.join(' ').replace(/\s+/g, ' ').trim();
    return name || '—';
  }

  openEditMember(index: number): void {
    this.memberToEditIndex = index;
    this.showMemberModal = true;
  }

  getMemberFormValue(index: number): FamilyMemberFormValue | null {
    if (!this.family || !this.family.members || !this.family.members[index]) {
      return null;
    }
    const m = this.family.members[index];
    return {
      id: m.id ? Number(m.id) : null,
      first_name: m.first_name,
      middle_name: m.middle_name,
      last_name: m.last_name,
      date_of_birth: m.date_of_birth,
      gender: m.gender,
      relationship_to_head: m.relationship_to_head,
      marital_status: m.marital_status,
      phone: m.phone,
      email: m.email,
      occupation: m.occupation,
      education: m.education,
      baptism_date: m.baptism_date,
      first_communion_date: m.first_communion_date,
      confirmation_date: m.confirmation_date,
      status: m.status
    };
  }

  onMemberModalSave(value: FamilyMemberFormValue): void {
    if (!this.family || !this.family.members || this.memberToEditIndex === null) {
      this.showMemberModal = false;
      this.memberToEditIndex = null;
      return;
    }
    const member = this.family.members[this.memberToEditIndex];
    const payload = { ...value, id: undefined } as any; // id managed by path param
    this.familyService.updateFamilyMember(String(this.family.id), String(member.id), payload).subscribe({
      next: (res) => {
        this.showMemberModal = false;
        this.memberToEditIndex = null;
        if (this.family?.id) {
          this.loadFamily(String(this.family.id));
        }
      },
      error: () => {
        this.showMemberModal = false;
        this.memberToEditIndex = null;
      }
    });
  }

  onMemberModalCancel(): void {
    this.showMemberModal = false;
    this.memberToEditIndex = null;
  }
}
