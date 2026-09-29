import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SacramentService } from '../../services/sacrament.service';

@Component({
  selector: 'app-certificate-verify-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <main class="verify-page">
      <h1>Certificate verification</h1>
      <p *ngIf="loading">Checking this certificate…</p>
      <p class="error" *ngIf="error">{{ error }}</p>
      <dl *ngIf="result">
        <div><dt>Sacrament</dt><dd>{{ result['sacrament_title'] }}</dd></div>
        <div><dt>Name</dt><dd>{{ result['recipient_name'] }}</dd></div>
        <div><dt>Date</dt><dd>{{ result['date_of_event'] }}</dd></div>
        <div><dt>Parish</dt><dd>{{ result['parish_name'] }}</dd></div>
        <div><dt>Certificate number</dt><dd>{{ result['certificate_number'] }}</dd></div>
        <div><dt>Status</dt><dd>{{ result['status'] }}</dd></div>
      </dl>
    </main>
  `,
  styles: [`
    .verify-page { max-width: 40rem; margin: 3rem auto; font-family: Georgia, serif; padding: 0 1.5rem; }
    h1 { font-size: 1.6rem; }
    dl div { display: flex; justify-content: space-between; gap: 1rem; border-bottom: 1px solid #e5e7eb; padding: 0.6rem 0; }
    dt { color: #6b7280; }
    .error { color: #991b1b; }
  `],
})
export class CertificateVerifyPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private sacraments = inject(SacramentService);
  loading = true;
  error: string | null = null;
  result: Record<string, unknown> | null = null;

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token') || '';
    this.sacraments.verifyCertificate(token).subscribe({
      next: (response) => {
        this.result = response.data;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.message || 'This certificate could not be verified.';
        this.loading = false;
      },
    });
  }
}
