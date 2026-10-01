import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MassIntentionsApiService } from '../services/mass-intentions-api.service';
import { MoveMassIntentionModalComponent } from './move-mass-intention-modal.component';

describe('MoveMassIntentionModalComponent', () => {
  let fixture: ComponentFixture<MoveMassIntentionModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MoveMassIntentionModalComponent],
      providers: [
        {
          provide: MassIntentionsApiService,
          useValue: {
            listCelebrations: jest.fn().mockReturnValue(
              of({
                data: [
                  {
                    id: 'mass-2',
                    celebrated_on: '2026-10-05',
                    celebrated_at: '09:00:00',
                    place: 'Chapel',
                  },
                ],
              })
            ),
            moveRequest: jest.fn(),
            bulkMoveRequests: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MoveMassIntentionModalComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('intentionIds', ['int-1']);
    fixture.componentRef.setInput('fromMassLabel', 'Sunday, 4 Oct 2026, 8:30 AM');
    fixture.componentRef.setInput('excludeCelebrationId', 'mass-1');
    fixture.detectChanges();
  });

  it('uses split sections and range segmented control', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.cf-split-form-body')).toBeTruthy();
    expect(el.textContent).toContain('Source Mass');
    expect(el.textContent).toContain('Sunday, 4 Oct 2026, 8:30 AM');
    expect(el.querySelector('.move-mass-modal__range button.active')?.textContent).toContain('14');
    expect(el.querySelector('.cf-split-form-actions .cf-btn-primary')?.textContent?.trim()).toBe('Move');
  });
});
