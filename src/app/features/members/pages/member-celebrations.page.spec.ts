import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MemberCelebrationsPageComponent } from './member-celebrations.page';
import { MemberService } from '../services/member.service';
import { BCCService } from '@core/services/bcc.service';

describe('MemberCelebrationsPageComponent', () => {
  let fixture: ComponentFixture<MemberCelebrationsPageComponent>;

  const memberService = {
    getCelebrationsList: jest.fn(() =>
      of({
        success: true,
        window: { start: '2026-06-17', end: '2026-06-23', label: '17 Jun 2026 – 23 Jun 2026', timezone: 'Asia/Kolkata' },
        type: 'birthdays',
        data: [
          {
            id: '1',
            family_id: 'f1',
            name: 'Alex Rivera',
            day_label: 'Wed',
            date_label: '18 Jun',
            detail: 'Turning 36',
            event_date: '2026-06-18',
            family_name: 'Rivera',
            bcc_name: 'North',
          },
        ],
        total: 1,
        current_page: 1,
        last_page: 1,
        per_page: 20,
        from: 1,
        to: 1,
      })
    ),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemberCelebrationsPageComponent],
      providers: [
        { provide: MemberService, useValue: memberService },
        {
          provide: BCCService,
          useValue: { getBCCs: jest.fn(() => of({ success: true, data: [] })) },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({ tab: 'birthdays' }) },
            queryParamMap: of(convertToParamMap({ tab: 'birthdays' })),
          },
        },
        { provide: Router, useValue: { navigate: jest.fn(() => Promise.resolve(true)) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MemberCelebrationsPageComponent);
    fixture.detectChanges();
  });

  it('loads birthdays for the active tab', () => {
    expect(memberService.getCelebrationsList).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'birthdays' })
    );
    expect(fixture.nativeElement.textContent).toContain('Alex Rivera');
  });

  it('shows permission message on forbidden response', () => {
    memberService.getCelebrationsList.mockReturnValueOnce(throwError(() => ({ status: 403 })));
    fixture.componentInstance.loadItems();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Families view permission');
  });
});
