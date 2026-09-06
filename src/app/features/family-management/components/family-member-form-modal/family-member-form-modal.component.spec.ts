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
});
