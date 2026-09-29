import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { EntitlementService } from '@core/services/entitlement.service';
import { IfFeatureDirective } from './if-feature.directive';

const features = signal<Record<string, boolean> | null>(null);

const entitlements = {
  entitlements: features,
  load: () => of(null),
  hasAllFeatures: (codes: string[]) => codes.every((c) => features()?.[c] !== false),
};

@Component({
  standalone: true,
  imports: [IfFeatureDirective],
  template: `
    <button id="plans" *appIfFeature="'CONTRIBUTION_PLANS'; else upsell">Plans</button>
    <ng-template #upsell><span id="upsell">Upgrade</span></ng-template>
    <span id="both" *appIfFeature="['CONTRIBUTIONS', 'AUDIT_LOG']">Both</span>
  `,
})
class HostComponent {}

describe('IfFeatureDirective', () => {
  beforeEach(() => {
    features.set(null);
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: EntitlementService, useValue: entitlements }],
    });
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows content while the plan is unknown', () => {
    const el = render();
    expect(el.querySelector('#plans')).not.toBeNull();
    expect(el.querySelector('#upsell')).toBeNull();
  });

  it('swaps to the else template when the plan lacks the feature, and back when it changes', () => {
    features.set({ CONTRIBUTION_PLANS: false, CONTRIBUTIONS: true, AUDIT_LOG: false });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#plans')).toBeNull();
    expect(el.querySelector('#upsell')).not.toBeNull();
    expect(el.querySelector('#both')).toBeNull();

    features.set({ CONTRIBUTION_PLANS: true, CONTRIBUTIONS: true, AUDIT_LOG: true });
    fixture.detectChanges();
    expect(el.querySelector('#plans')).not.toBeNull();
    expect(el.querySelector('#upsell')).toBeNull();
    expect(el.querySelector('#both')).not.toBeNull();
  });
});
