import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FocActionCenterComponent } from './foc-action-center.component';
import { FinancialCommandCenterPayload } from '../../../models/donation.model';

describe('FocActionCenterComponent', () => {
  let component: FocActionCenterComponent;
  let fixture: ComponentFixture<FocActionCenterComponent>;

  const data = {
    action_center: [
      {
        key: 'families_follow_up',
        priority: 'high',
        title: 'Families Requiring Follow-Up',
        affected_count: 2,
        expected_amount: 500,
        summary: 'Needs follow-up',
        suggested_actions: ['Review Families'],
        cta_route: '/donations/dues'
      }
    ]
  } as FinancialCommandCenterPayload;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FocActionCenterComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(FocActionCenterComponent);
    component = fixture.componentInstance;
    component.data = data;
    fixture.detectChanges();
  });

  it('renders action queue cards', () => {
    expect(fixture.nativeElement.textContent).toContain('Families Requiring Follow-Up');
  });

  it('moves keyboard focus across queues', () => {
    component.onQueueKeydown(new KeyboardEvent('keydown', { key: 'ArrowRight' }), 0);
    expect(component.focusedIndex).toBe(0);
  });
});
