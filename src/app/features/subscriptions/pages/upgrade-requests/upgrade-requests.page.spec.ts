import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ConfirmationDialogService } from '@core/services/confirmation-dialog.service';
import { ToastService } from '@core/services/toast.service';
import { SubscriptionAdminService } from '../../services/subscription-admin.service';
import { UpgradeRequest } from '../../models/tenant-subscription.models';
import { UpgradeRequestsPage } from './upgrade-requests.page';

const pending: UpgradeRequest = {
  id: 7,
  status: 'PENDING',
  current_plan: { id: 1, code: 'STARTER', name: 'Starter' },
  requested_plan: { id: 2, code: 'STANDARD', name: 'Standard' },
  requested_billing_interval: 'ANNUAL',
  requested_feature_code: null,
  message: 'We are growing',
  review_note: null,
  reviewed_at: null,
  created_at: '2026-09-20T10:00:00Z',
  tenant: { id: 5, name: 'St. Mary Parish' },
} as unknown as UpgradeRequest;

function setup(permissions: string[]) {
  const api = {
    upgradeRequests: jest.fn().mockReturnValue(
      of({ data: [pending], meta: { current_page: 1, last_page: 1, per_page: 25, total: 1, open_count: 1 } }),
    ),
    approveUpgradeRequest: jest.fn(),
    rejectUpgradeRequest: jest.fn().mockReturnValue(of({})),
    requestUpgradeInfo: jest.fn().mockReturnValue(of({})),
  };
  const dialog = { confirm: jest.fn().mockReturnValue(of({ confirmed: true })) };
  const toast = { success: jest.fn(), error: jest.fn() };

  TestBed.configureTestingModule({
    imports: [UpgradeRequestsPage],
    providers: [
      provideRouter([]),
      { provide: SubscriptionAdminService, useValue: api },
      { provide: ConfirmationDialogService, useValue: dialog },
      { provide: ToastService, useValue: toast },
      {
        provide: AuthService,
        useValue: { isSuperAdmin: () => false, hasPermission: (p: string) => permissions.includes(p) },
      },
    ],
  });

  const fixture = TestBed.createComponent(UpgradeRequestsPage);
  fixture.detectChanges();
  return { fixture, page: fixture.componentInstance, api, dialog, toast };
}

const REVIEWER = ['subscriptions.requests.review', 'subscriptions.tenants.manage'];

describe('UpgradeRequestsPage', () => {
  it('loads open requests for reviewers', () => {
    const { page, api, fixture } = setup(REVIEWER);

    expect(api.upgradeRequests).toHaveBeenCalledWith({ status: 'OPEN', page: 1, perPage: 25 });
    expect(page.requests).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('St. Mary Parish');
  });

  it('does not call the API without the review permission', () => {
    const { api } = setup([]);

    expect(api.upgradeRequests).not.toHaveBeenCalled();
  });

  it('only offers approval when the reviewer can also change church plans', () => {
    expect(setup(['subscriptions.requests.review']).page.canApprove(pending)).toBe(false);
    TestBed.resetTestingModule();
    expect(setup(REVIEWER).page.canApprove(pending)).toBe(true);
  });

  it('asks for confirmation when approval would put the church over a limit, then retries', () => {
    const { page, api, dialog, toast } = setup(REVIEWER);
    const impact = new HttpErrorResponse({
      status: 422,
      error: { code: 'PLAN_CHANGE_REQUIRES_CONFIRMATION', message: 'This church has 300 people; the plan allows 250.' },
    });
    api.approveUpgradeRequest.mockReturnValueOnce(throwError(() => impact)).mockReturnValueOnce(of({}));

    page.start(pending, 'approve');
    page.submit(pending);

    expect(api.approveUpgradeRequest).toHaveBeenNthCalledWith(1, 7, { note: null, confirm_impact: false });
    expect(dialog.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ confirmText: 'Approve anyway', variant: 'primary' }),
    );
    expect(dialog.confirm.mock.calls[0][0].message).toContain('Nothing will be deleted');
    expect(api.approveUpgradeRequest).toHaveBeenNthCalledWith(2, 7, { note: null, confirm_impact: true });
    expect(toast.success).toHaveBeenCalledWith('St. Mary Parish is now on Standard.', 'Saved');
  });

  it('does not retry when the reviewer cancels the confirmation', () => {
    const { page, api, dialog, toast } = setup(REVIEWER);
    dialog.confirm.mockReturnValue(of({ confirmed: false }));
    api.approveUpgradeRequest.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { code: 'PLAN_CHANGE_REQUIRES_CONFIRMATION' } })),
    );

    page.start(pending, 'approve');
    page.submit(pending);

    expect(api.approveUpgradeRequest).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('requires a note before declining', () => {
    const { page, api } = setup(REVIEWER);

    page.start(pending, 'reject');
    page.note = ' ';
    page.submit(pending);
    expect(api.rejectUpgradeRequest).not.toHaveBeenCalled();

    page.note = 'Please talk to us first';
    page.submit(pending);
    expect(api.rejectUpgradeRequest).toHaveBeenCalledWith(7, 'Please talk to us first');
  });
});
