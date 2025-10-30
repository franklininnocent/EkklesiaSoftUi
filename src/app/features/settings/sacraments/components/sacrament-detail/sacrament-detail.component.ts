import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SacramentService } from '../../services/sacrament.service';
import { Sacrament } from '../../models/sacrament.model';
import { ToastService } from '@core/services/toast.service';

@Component({
  selector: 'app-sacrament-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sacrament-detail.component.html',
  styleUrl: './sacrament-detail.component.scss',
  providers: [DatePipe]
})
export class SacramentDetailComponent implements OnInit {
  sacrament: Sacrament | null = null;
  loading = false;
  sacramentId: number | null = null;

  constructor(
    private sacramentService: SacramentService,
    private toastService: ToastService,
    private router: Router,
    private route: ActivatedRoute,
    private datePipe: DatePipe
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.sacramentId = parseInt(id, 10);
      this.loadSacrament();
    }
  }

  loadSacrament(): void {
    if (!this.sacramentId) return;

    this.loading = true;
    this.sacramentService.getSacrament(this.sacramentId).subscribe({
      next: (response) => {
        if (response.success) {
          this.sacrament = response.data;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading sacrament:', error);
        this.toastService.error('Failed to load sacrament details.');
        this.loading = false;
        this.router.navigate(['/settings/sacraments']);
      }
    });
  }

  onBack(): void {
    this.router.navigate(['/settings/sacraments']);
  }

  onEdit(): void {
    if (this.sacrament) {
      this.router.navigate(['/settings/sacraments/edit', this.sacrament.id]);
    }
  }

  onPrint(): void {
    window.print();
  }

  getStatusBadgeClass(status: string): string {
    const baseClass = 'status-badge';
    switch (status) {
      case 'active': return `${baseClass} status-active`;
      case 'cancelled': return `${baseClass} status-cancelled`;
      case 'conditional': return `${baseClass} status-conditional`;
      default: return baseClass;
    }
  }
}


