import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Store } from '@ngrx/store';
import { Subject, finalize } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AppState } from '@core/store';
import * as AuthActions from '@core/store/auth/auth.actions';
import { AuthService } from '@core/services/auth.service';
import { ToastService } from '@core/services/toast.service';
import { ModalShellComponent } from '@shared/components';
import { evaluatePasswordPolicy } from '@core/utils/password-policy.util';

@Component({
  selector: 'app-change-password-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ModalShellComponent],
  templateUrl: './change-password-modal.component.html',
  styleUrl: './change-password-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordModalComponent implements OnInit, OnDestroy {
  @Input() forced = false;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);
  private readonly store = inject(Store<AppState>);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroy$ = new Subject<void>();

  readonly form = this.fb.nonNullable.group(
    {
      current_password: ['', Validators.required],
      password: ['', Validators.required],
      password_confirmation: ['', Validators.required],
    },
    { validators: this.passwordsMatchValidator }
  );

  isSavingPassword = false;
  errorMessage: string | null = null;

  ngOnInit(): void {
    this.form.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.errorMessage) {
        this.errorMessage = null;
        this.cdr.markForCheck();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onCloseRequested(): void {
    this.close();
  }

  close(): void {
    if (this.forced || this.isSavingPassword) {
      return;
    }

    this.closed.emit();
  }

  submit(): void {
    if (this.isSavingPassword) {
      return;
    }

    this.errorMessage = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage = 'All password fields are required.';
      this.cdr.markForCheck();
      return;
    }

    const { current_password, password, password_confirmation } = this.form.getRawValue();

    this.isSavingPassword = true;
    this.cdr.markForCheck();

    this.authService
      .changePassword({
        current_password,
        password,
        password_confirmation,
      })
      .pipe(
        finalize(() => {
          this.isSavingPassword = false;
          this.cdr.markForCheck();
        }),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: () => {
          this.form.reset();
          this.authService.refreshUser();
          this.store.dispatch(AuthActions.loadUser());
          this.toastService.success('Password changed successfully.', 'Security');
          this.saved.emit();
          this.closed.emit();
        },
        error: (error) => {
          const message = this.resolvePasswordChangeError(error);
          this.errorMessage = message;
          this.toastService.error(message, 'Security');
          this.cdr.markForCheck();
        },
      });
  }

  get passwordChecks() {
    return evaluatePasswordPolicy(String(this.form.get('password')?.value ?? ''));
  }

  hasError(controlName: 'current_password' | 'password' | 'password_confirmation'): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  private passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmation = control.get('password_confirmation')?.value;

    if (!password || !confirmation || password === confirmation) {
      return null;
    }

    return { passwordMismatch: true };
  }

  private resolvePasswordChangeError(error: {
    message?: string;
    status?: number;
    errors?: Record<string, string[]>;
    error?: { message?: string; errors?: Record<string, string[]> };
  }): string {
    // Prefer interceptor-flattened shape ({ message, errors }) over raw HttpErrorResponse.
    const fieldErrors = error?.errors ?? error?.error?.errors;
    if (fieldErrors) {
      const firstField = Object.keys(fieldErrors)[0];
      const firstMessage = firstField ? fieldErrors[firstField]?.[0] : undefined;
      if (firstMessage) {
        return firstMessage;
      }
    }

    const apiMessage = (error?.message || error?.error?.message || '').trim();
    if (apiMessage) {
      return this.toUserFacingPasswordMessage(apiMessage);
    }

    return 'Unable to change password. Check your current password and try a different new password.';
  }

  /** Map known API codes/messages into plain-language guidance. */
  private toUserFacingPasswordMessage(apiMessage: string): string {
    const normalized = apiMessage.toLowerCase();
    if (normalized.includes('reuse a recent password')) {
      return 'That new password was used recently. Please choose a different password you have not used before.';
    }
    if (normalized.includes('must differ from your current password')) {
      return 'Your new password must be different from your current password.';
    }
    if (normalized.includes('current password is incorrect')) {
      return 'Current password is incorrect. Enter the password you use to sign in.';
    }
    return apiMessage;
  }
}
