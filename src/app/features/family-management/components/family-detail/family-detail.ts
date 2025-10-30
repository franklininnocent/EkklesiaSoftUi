import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FamilyService } from '../../../../core/services/family.service';
import { Family } from '../../../../core/models/family.model';
import { FamilyFormComponent } from '../family-form/family-form';

@Component({
  selector: 'app-family-detail',
  standalone: true,
  imports: [CommonModule, FamilyFormComponent],
  templateUrl: './family-detail.html',
  styleUrls: ['./family-detail.scss'],
})
export class FamilyDetail implements OnInit {
  family: Family | null = null;
  loading = true;
  error: string | null = null;
  showEdit = false;

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
}
