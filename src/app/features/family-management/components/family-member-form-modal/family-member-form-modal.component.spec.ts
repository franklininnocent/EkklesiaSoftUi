import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { FamilyMemberFormModalComponent } from './family-member-form-modal.component';

describe('FamilyMemberFormModalComponent (basics)', () => {
  it('requires date of birth when creating a new member', () => {
    TestBed.configureTestingModule({
      imports: [FamilyMemberFormModalComponent, HttpClientTestingModule]
    });
    const fixture = TestBed.createComponent(FamilyMemberFormModalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.form.patchValue({
      first_name: 'John',
      last_name: 'Doe',
      relationship_to_head: 'son',
    });
    expect(component.form.valid).toBe(false);

    component.form.patchValue({ date_of_birth: '2015-04-10' });
    expect(component.form.valid).toBe(true);
  });

  it('includes Family Head in the relationship dropdown when adding a member', () => {
    TestBed.configureTestingModule({
      imports: [FamilyMemberFormModalComponent, HttpClientTestingModule]
    });
    const fixture = TestBed.createComponent(FamilyMemberFormModalComponent);
    fixture.componentInstance.isHeadOnly = false;
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('#member_relationship') as HTMLSelectElement;
    const options = Array.from(select.options).map((option) => ({
      value: option.value,
      label: option.textContent?.trim() ?? '',
    }));

    expect(options.some((option) => option.value === 'self' && option.label === 'Family Head')).toBe(true);
    expect(options.some((option) => option.value === 'spouse')).toBe(true);
  });

  it('emits save with relationship self when Family Head is selected', () => {
    TestBed.configureTestingModule({
      imports: [FamilyMemberFormModalComponent, HttpClientTestingModule]
    });
    const fixture = TestBed.createComponent(FamilyMemberFormModalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.form.patchValue({
      first_name: 'Jane',
      last_name: 'Doe',
      relationship_to_head: 'self',
      date_of_birth: '1980-05-15',
    });
    expect(component.form.valid).toBe(true);

    const spy = jest.fn();
    component.save.subscribe(spy);
    component.onSave();

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      relationship_to_head: 'self',
      first_name: 'Jane',
      last_name: 'Doe',
    }));
  });

  it('emits save on valid create form', () => {
    TestBed.configureTestingModule({
      imports: [FamilyMemberFormModalComponent, HttpClientTestingModule]
    });
    const fixture = TestBed.createComponent(FamilyMemberFormModalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.form.patchValue({
      first_name: 'John',
      last_name: 'Doe',
      relationship_to_head: 'son',
      date_of_birth: '2015-04-10',
    });
    expect(component.form.valid).toBe(true);

    const spy = jest.fn();
    component.save.subscribe(spy);
    component.onSave();
    expect(spy).toHaveBeenCalled();
  });

  it('shows marriage date only when marital status is married', () => {
    TestBed.configureTestingModule({
      imports: [FamilyMemberFormModalComponent, HttpClientTestingModule]
    });
    const fixture = TestBed.createComponent(FamilyMemberFormModalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#member_marriage_date')).toBeNull();

    component.form.patchValue({ marital_status: 'married' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#member_marriage_date')).toBeTruthy();

    component.form.patchValue({ marital_status: 'widowed', marriage_date: '2010-06-20' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#member_marriage_date')).toBeNull();
    expect(component.form.get('marriage_date')?.value).toBe('2010-06-20');
  });

  it('shows marriage date in family head edit mode when married', () => {
    TestBed.configureTestingModule({
      imports: [FamilyMemberFormModalComponent, HttpClientTestingModule]
    });
    const fixture = TestBed.createComponent(FamilyMemberFormModalComponent);
    const component = fixture.componentInstance;
    component.isHeadOnly = true;
    fixture.detectChanges();

    component.form.patchValue({ marital_status: 'married' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#member_marriage_date')).toBeTruthy();
  });

  it('prefills marriage date from suggested_marriage_date', () => {
    TestBed.configureTestingModule({
      imports: [FamilyMemberFormModalComponent, HttpClientTestingModule]
    });
    const fixture = TestBed.createComponent(FamilyMemberFormModalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.member = {
      id: '11111111-1111-1111-1111-111111111111',
      first_name: 'Jane',
      last_name: 'Doe',
      relationship_to_head: 'self',
      marital_status: 'married',
      suggested_marriage_date: '2011-02-03',
      marriage_date_conflict: true,
    };
    component.ngOnChanges({
      member: {
        currentValue: component.member,
        previousValue: null,
        firstChange: true,
        isFirstChange: () => true,
      }
    });
    fixture.detectChanges();

    expect(component.form.get('marriage_date')?.value).toBe('2011-02-03');
    expect(fixture.nativeElement.querySelector('#member_marriage_date')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('parish marriage register');
  });
});
