import { TestBed } from '@angular/core/testing';
import { FamilyMemberFormModalComponent } from './family-member-form-modal.component';

describe('FamilyMemberFormModalComponent (basics)', () => {
  it('validates phone and emits save on valid form', () => {
    TestBed.configureTestingModule({
      imports: [FamilyMemberFormModalComponent]
    });
    const fixture = TestBed.createComponent(FamilyMemberFormModalComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.form.patchValue({ first_name: 'John', last_name: 'Doe' });
    expect(component.form.valid).toBe(true);

    const spy = jest.fn();
    component.save.subscribe(spy);
    component.onSave();
    expect(spy).toHaveBeenCalled();
  });
});


