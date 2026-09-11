import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { SupportTicketService } from '../../services/support-ticket.service';
import { SupportLookupType } from '../../models/support-ticket.model';

@Component({
  selector: 'app-support-ticket-create-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgSelectModule, ModalShellComponent],
  templateUrl: './support-ticket-create-modal.component.html',
  styleUrl: './support-ticket-create-modal.component.scss',
})
export class SupportTicketCreateModalComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  @Output() created = new EventEmitter<string>();

  private readonly fb = inject(FormBuilder);
  private readonly tickets = inject(SupportTicketService);

  requestTypes: SupportLookupType[] = [];
  loadingLookups = true;
  saving = false;
  error: string | null = null;

  form = this.fb.group({
    request_type_id: [null as number | null, Validators.required],
    category_id: [null as number | null],
    subject: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', [Validators.required, Validators.maxLength(20000)]],
    priority: ['normal'],
    business_impact: [''],
    affected_module: [''],
    steps_to_reproduce: [''],
    expected_result: [''],
    actual_result: [''],
    error_message: [''],
    bug_frequency: [''],
    bug_browser: [''],
    bug_device: [''],
  });

  ngOnInit(): void {
    this.tickets.getLookups().subscribe({
      next: (types) => {
        this.requestTypes = types;
        this.loadingLookups = false;
      },
      error: () => {
        this.error = 'Could not load request types. Please try again.';
        this.loadingLookups = false;
      },
    });
  }

  get hasRequestTypes(): boolean {
    return this.requestTypes.length > 0;
  }

  get isBugReport(): boolean {
    return !!this.selectedType?.requires_bug_fields;
  }

  get selectedType(): SupportLookupType | undefined {
    const id = this.form.value.request_type_id;
    return this.requestTypes.find((t) => t.id === id);
  }

  onClose(): void {
    if (this.saving) {
      return;
    }
    this.close.emit();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    this.saving = true;
    this.error = null;

    this.tickets
      .createTicket({
        request_type_id: v.request_type_id!,
        category_id: v.category_id,
        subject: v.subject!,
        description: v.description!,
        priority: v.priority || 'normal',
        business_impact: v.business_impact || undefined,
        affected_module: v.affected_module || undefined,
        steps_to_reproduce: this.isBugReport ? v.steps_to_reproduce || undefined : undefined,
        expected_result: this.isBugReport ? v.expected_result || undefined : undefined,
        actual_result: this.isBugReport ? v.actual_result || undefined : undefined,
        error_message: v.error_message || undefined,
        bug_details: this.isBugReport
          ? {
              frequency: v.bug_frequency || undefined,
              browser: v.bug_browser || undefined,
              device: v.bug_device || undefined,
            }
          : undefined,
        submit: true,
      })
      .subscribe({
        next: (ticket) => {
          this.created.emit(ticket.ticket_number);
        },
        error: (err) => {
          this.error = err?.error?.message || 'Could not create ticket.';
          this.saving = false;
        },
      });
  }
}
