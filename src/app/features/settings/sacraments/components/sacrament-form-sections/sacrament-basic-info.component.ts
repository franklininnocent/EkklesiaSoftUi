/**
 * Sacrament Basic Information Component
 * Handles basic sacrament information section
 */

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SacramentType } from '../../models/sacrament.model';
import { SacramentFormService } from '../../services/sacrament-form.service';
import { DATE_VALIDATION } from '../../constants/sacrament.constants';

@Component({
  selector: 'app-sacrament-basic-info',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="form-section">
      <h3 class="section-title">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
          <circle cx="12" cy="10" r="3"></circle>
        </svg>
        Sacrament Information
      </h3>
      <div class="form-grid">
        <div class="form-group">
          <label class="required">Sacrament Type</label>
          <select 
            [(ngModel)]="formData.sacrament_type_id" 
            (ngModelChange)="onSacramentTypeChange()"
            name="sacrament_type_id" 
            class="form-control" 
            required>
            <option [ngValue]="undefined">Select a sacrament...</option>
            <option *ngFor="let type of sacramentTypes" [ngValue]="type.id">
              {{ type.name }}
            </option>
          </select>
        </div>

        <div class="form-group">
          <label class="required">{{ isMarriage ? 'Marriage Date' : 'Date Administered' }}</label>
          <input
            type="date"
            [(ngModel)]="formData.date_administered"
            name="date_administered"
            class="form-control"
            [max]="maxDate"
            required>
          <small class="form-hint">Format: YYYY-MM-DD (e.g., 2025-11-21). Date cannot be more than {{ DATE_VALIDATION.MAX_FUTURE_DAYS }} day(s) in the future.</small>
        </div>

        <div class="form-group">
          <label>{{ isMarriage ? 'Marriage Place' : 'Place Administered' }}</label>
          <input
            type="text"
            [(ngModel)]="formData.place_administered"
            name="place_administered"
            class="form-control"
            placeholder="Church name or location">
        </div>

        <div class="form-group">
          <label>Status</label>
          <select [(ngModel)]="formData.status" name="status" class="form-control">
            <option *ngFor="let option of statusOptions" [value]="option.value">
              {{ option.label }}
            </option>
          </select>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .form-section {
      margin-bottom: 2rem;
    }
    .section-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1rem;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 0.85rem;
    }
    .section-title svg {
      flex-shrink: 0;
      color: #667eea;
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }
    .form-group {
      position: relative;
    }
    .form-group.full-width {
      grid-column: 1 / -1;
    }
    label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
      color: #374151;
    }
    label.required::after {
      content: ' *';
      color: #ef4444;
    }
    .form-control {
      width: 100%;
      padding: 0.65rem 0.85rem;
      border: 2px solid #cbd5e1;
      border-radius: 10px;
      font-size: 0.95rem;
    }
    .form-hint {
      display: block;
      margin-top: 0.375rem;
      font-size: 0.813rem;
      color: #6b7280;
    }
  `]
})
export class SacramentBasicInfoComponent {
  @Input() formData!: Record<string, unknown>;
  @Input() sacramentTypes: SacramentType[] = [];
  @Input() statusOptions: Array<{value: string; label: string}> = [];
  @Input() isMarriage = false;
  @Output() sacramentTypeChange = new EventEmitter<void>();

  readonly DATE_VALIDATION = DATE_VALIDATION;
  readonly maxDate = this.formService.getMaxDate();

  constructor(private readonly formService: SacramentFormService) {}

  onSacramentTypeChange(): void {
    this.sacramentTypeChange.emit();
  }
}

