import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { EntitlementService } from '@core/services/entitlement.service';
import { TenantSubscriptionService } from '../../services/tenant-subscription.service';
import { FeatureUnavailablePageComponent } from './feature-unavailable.page';

function render(feature: string, canManage: boolean) {
  TestBed.configureTestingModule({
    imports: [FeatureUnavailablePageComponent],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({ feature })) } },
      { provide: AuthService, useValue: { canViewMySubscription: () => canManage } },
      {
        provide: EntitlementService,
        useValue: {
          load: () => of(null),
          entitlements: signal(null),
          plan: signal({ code: 'STARTER', name: 'Starter' }),
          featureName: (code: string) => (code === 'MINISTRIES' ? 'Ministries' : code),
        },
      },
      {
        provide: TenantSubscriptionService,
        useValue: {
          publicPlans: () =>
            of([
              { code: 'STARTER', name: 'Starter', features: [] },
              { code: 'STANDARD', name: 'Standard', features: [{ code: 'MINISTRIES' }] },
              { code: 'PROFESSIONAL', name: 'Professional', features: [{ code: 'MINISTRIES' }] },
            ]),
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(FeatureUnavailablePageComponent);
  fixture.detectChanges();
  return fixture;
}

describe('FeatureUnavailablePageComponent', () => {
  it('explains which plans include the feature and links to a plan request', () => {
    const fixture = render('ministries', true);
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('Ministries is not part of the Starter plan');
    expect(el.textContent).toContain('nothing has been removed');
    const plans = Array.from(el.querySelectorAll('.fu-plans li')).map((li) => li.textContent?.trim());
    expect(plans).toEqual(['Standard', 'Professional']);
    const link = el.querySelector('a[href*="my-subscription"]') as HTMLAnchorElement;
    expect(link.textContent).toContain('Request plan upgrade');
    expect(link.getAttribute('href')).toContain('request=MINISTRIES');
  });

  it('tells staff to ask their administrator instead of offering a request', () => {
    const el: HTMLElement = render('MINISTRIES', false).nativeElement;

    expect(el.querySelector('a[href*="my-subscription"]')).toBeNull();
    expect(el.textContent).toContain('ask your church administrator');
  });

  it('strips unsafe characters from the feature code', () => {
    const fixture = render('<script>x</script>', true);

    expect(fixture.componentInstance.featureCode()).toBe('SCRIPTXSCRIPT');
  });
});
