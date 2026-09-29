import { TestBed } from '@angular/core/testing';
import { PublicPlanCard } from '../../models/subscription-admin.models';
import { PlanComparisonComponent } from './plan-comparison.component';

function plan(code: string, order: number, features: string[], extra: Partial<PublicPlanCard> = {}): PublicPlanCard {
  return {
    code,
    name: code.charAt(0) + code.slice(1).toLowerCase(),
    short_description: null,
    badge_label: null,
    is_featured: false,
    pricing_type: 'FIXED',
    currency_code: 'INR',
    monthly_price: '1499.00',
    annual_price: '14990.00',
    trial_days: null,
    billing_intervals: ['MONTHLY', 'ANNUAL'],
    tax: { label: 'GST', rate_percent: '18.00', prices_include_tax: false },
    features: features.map((f) => ({ code: f, name: f.toLowerCase(), category: 'x' })),
    limits: [{ code: 'PEOPLE_LIMIT', name: 'People', unit: 'people', value: 250, unlimited: false }],
    display_order: order,
    ...extra,
  } as PublicPlanCard;
}

describe('PlanComparisonComponent', () => {
  const plans = [
    plan('STANDARD', 2, ['CONTRIBUTIONS', 'CONTRIBUTION_PLANS'], { badge_label: 'Most Popular', is_featured: true }),
    plan('STARTER', 1, ['CONTRIBUTIONS']),
    plan('ENTERPRISE', 4, ['CONTRIBUTIONS', 'CONTRIBUTION_PLANS'], { pricing_type: 'CUSTOM', monthly_price: null, annual_price: null }),
  ];

  function create(inputs: Record<string, unknown>) {
    TestBed.configureTestingModule({ imports: [PlanComparisonComponent] });
    const fixture = TestBed.createComponent(PlanComparisonComponent);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    return fixture;
  }

  it('orders plans and lists only what each plan adds (features are cumulative)', () => {
    const fixture = create({ plans, currentCode: 'STARTER' });
    const cards = fixture.componentInstance.cards();
    expect(cards.map((c) => c.plan.code)).toEqual(['STARTER', 'STANDARD', 'ENTERPRISE']);
    expect(cards[1].previousName).toBe('Starter');
    expect(cards[1].newFeatures.map((f) => f.code)).toEqual(['CONTRIBUTION_PLANS']);
    expect(cards[2].newFeatures).toEqual([]);
    expect(cards[0].isCurrent).toBe(true);
  });

  it('shows prices with the tax note, custom pricing and the catalog badge', () => {
    const el = create({ plans }).nativeElement as HTMLElement;
    const text = el.textContent ?? '';
    expect(text).toContain('/ month');
    expect(text).toContain('Plus GST (18%)');
    expect(text).toContain('Custom pricing');
    expect(text).toContain('Most Popular');
  });

  it('emits the chosen plan and hides the button for the current or already requested plan', () => {
    const fixture = create({ plans, currentCode: 'STARTER', requestedCode: 'ENTERPRISE', selectable: true, highlightFeature: 'CONTRIBUTION_PLANS' });
    const chosen: string[] = [];
    fixture.componentInstance.choose.subscribe((p) => chosen.push(p.code));
    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Request this plan']);
    buttons[0].click();
    expect(chosen).toEqual(['STANDARD']);
    expect(fixture.nativeElement.textContent).toContain('Includes what you asked about');
    expect(fixture.nativeElement.textContent).toContain('Request sent');
  });
});
