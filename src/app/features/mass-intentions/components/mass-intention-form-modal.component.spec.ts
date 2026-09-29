import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '@core/services/auth.service';
import { ParishPersonService } from '@features/settings/sacraments/services/person.service';
import { MassIntentionsApiService } from '../services/mass-intentions-api.service';
import { MassIntentionFormModalComponent } from './mass-intention-form-modal.component';

describe('MassIntentionFormModalComponent', () => {
  let fixture: ComponentFixture<MassIntentionFormModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MassIntentionFormModalComponent],
      providers: [
        {
          provide: MassIntentionsApiService,
          useValue: {
            listCategories: jest.fn().mockReturnValue(
              of({
                data: [{ id: 'cat-1', code: 'THANKSGIVING', name: 'Thanksgiving', active: true, sort_order: 1 }],
              })
            ),
            getRequest: jest.fn(),
            createRequest: jest.fn(),
            updateRequest: jest.fn(),
            createCategory: jest.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: { hasTenantPermission: jest.fn(() => true) },
        },
        { provide: ParishPersonService, useValue: { search: jest.fn().mockReturnValue(of({ data: [] })) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MassIntentionFormModalComponent);
    fixture.componentInstance.open = true;
    fixture.detectChanges();
  });

  it('shows place field when beneficiary is not linked', () => {
    expect(fixture.nativeElement.querySelector('#mass-intention-place')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#mass-intention-bcc')).toBeFalsy();
  });

  it('loads category select and shows description when a type is selected', () => {
    const select = fixture.nativeElement.querySelector('#mass-intention-category') as HTMLSelectElement;
    expect(select).toBeTruthy();
    select.value = 'cat-1';
    select.dispatchEvent(new Event('change'));
    fixture.componentInstance.form.patchValue({ mass_intention_category_id: 'cat-1' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#mass-intention-description')).toBeTruthy();
  });
});
