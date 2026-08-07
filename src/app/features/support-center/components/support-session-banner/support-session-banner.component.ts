import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Subject, interval, startWith, takeUntil } from 'rxjs';
import { SupportSessionService } from '../../services/support-session.service';
import { SupportSession } from '../../models/support-access.model';
import {
  ConfirmationModalComponent,
  ConfirmationResult,
} from '@shared/components/confirmation-modal/confirmation-modal.component';
import { ModalShellComponent } from '@shared/components/modal-shell/modal-shell.component';
import { FormFieldComponent } from '@shared/components/form-field/form-field.component';
import { fieldErrorText, markFormGroupTouched } from '@core/validators/form-validation.helper';

@Component({
  selector: 'app-support-session-banner',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    ConfirmationModalComponent,
    ModalShellComponent,
    FormFieldComponent,
  ],
  templateUrl: './support-session-banner.component.html',
  styleUrl: './support-session-banner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportSessionBannerComponent implements OnInit, OnDestroy {
  private readonly sessions = inject(SupportSessionService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly fb = inject(FormBuilder);
  private readonly destroy$ = new Subject<void>();

  session: SupportSession | null = null;
  remainingLabel = '';
  ending = false;
  renewing = false;
  renewSubmitted = false;
  error: string | null = null;
  success: string | null = null;
  showExitConfirm = false;
  showRenewDialog = false;

  readonly renewForm = this.fb.nonNullable.group({
    password: ['', Validators.required],
  });

  ngOnInit(): void {
    this.sessions.session$.pipe(takeUntil(this.destroy$)).subscribe((session) => {
      this.session = session;
      this.updateRemaining();
      this.cdr.markForCheck();
    });

    interval(1000)
      .pipe(startWith(0), takeUntil(this.destroy$))
      .subscribe(() => {
        this.updateRemaining();
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  requestExit(): void {
    if (!this.session || this.ending) {
      return;
    }
    this.showExitConfirm = true;
    this.cdr.markForCheck();
  }

  onExitConfirmed(result: ConfirmationResult): void {
    this.showExitConfirm = false;
    if (!result.confirmed) {
      this.cdr.markForCheck();
      return;
    }
    this.exit();
  }

  requestRenew(): void {
    this.renewForm.reset({ password: '' });
    this.renewSubmitted = false;
    this.showRenewDialog = true;
    this.error = null;
    this.success = null;
    this.cdr.markForCheck();
  }

  closeRenewDialog(): void {
    if (this.renewing) {
      return;
    }
    this.showRenewDialog = false;
    this.renewSubmitted = false;
    this.renewForm.reset({ password: '' });
    this.cdr.markForCheck();
  }

  submitRenew(): void {
    if (!this.session || this.renewing) {
      return;
    }

    this.renewSubmitted = true;
    markFormGroupTouched(this.renewForm, '#support-renew-form ');
    this.cdr.markForCheck();
    if (this.renewForm.invalid) {
      return;
    }

    const password = this.renewForm.controls.password.value.trim();
    this.renewing = true;
    this.error = null;
    this.success = null;
    this.sessions
      .renew(this.session.id, password)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.renewing = false;
          this.showRenewDialog = false;
          this.renewSubmitted = false;
          this.renewForm.reset({ password: '' });
          this.success = 'Session extended.';
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.renewing = false;
          this.error = err?.error?.message || 'Could not renew support session.';
          this.cdr.markForCheck();
        },
      });
  }

  renewPasswordError(): string | null {
    return fieldErrorText('password', this.renewForm, this.renewSubmitted);
  }

  private exit(): void {
    if (!this.session || this.ending) {
      return;
    }
    this.ending = true;
    this.error = null;
    this.success = null;
    this.sessions
      .end(this.session.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.ending = false;
          this.cdr.markForCheck();
          void this.router.navigate(['/support-center']);
        },
        error: (err) => {
          this.ending = false;
          this.error = err?.error?.message || 'Could not end support session.';
          this.cdr.markForCheck();
        },
      });
  }

  private updateRemaining(): void {
    if (!this.session?.expires_at) {
      this.remainingLabel = '';
      return;
    }
    const ms = new Date(this.session.expires_at).getTime() - Date.now();
    if (ms <= 0) {
      this.remainingLabel = 'Expired';
      this.sessions.clearSession();
      return;
    }
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    this.remainingLabel = `${mins}m ${secs.toString().padStart(2, '0')}s`;
  }
}
