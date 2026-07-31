import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { BCCFormComponent } from './bcc-form';
import { BCCService } from '../../../../core/services/bcc.service';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

class BCCServiceMock {
  createBCC = jest.fn((payload: any) => of({ success: true, data: { id: '1', ...payload } }));
  updateBCC = jest.fn((id: string, payload: any) => of({ success: true, data: { id, ...payload } }));
}

describe('BCCFormComponent', () => {
  let component: BCCFormComponent;
  let fixture: ComponentFixture<BCCFormComponent>;
  let service: BCCServiceMock;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommonModule, ReactiveFormsModule, BCCFormComponent],
      providers: [{ provide: BCCService, useClass: BCCServiceMock }]
    }).compileComponents();

    fixture = TestBed.createComponent(BCCFormComponent);
    component = fixture.componentInstance;
    service = TestBed.inject(BCCService) as unknown as BCCServiceMock;
    fixture.detectChanges();
  });

  it('requires only name and status fields after removals', () => {
    const form = component.bccForm;
    // Removed fields should not exist in the form
    expect(form.contains('min_families')).toBe(false);
    expect(form.contains('max_families')).toBe(false);
    expect(form.contains('contact_email')).toBe(false);
    expect(form.contains('contact_phone')).toBe(false);

    // Required fields
    form.get('name')?.setValue('');
    form.get('status')?.setValue('active');
    expect(form.valid).toBe(false);

    form.get('name')?.setValue('Test BCC');
    expect(form.valid).toBe(true);
  });

  it('emits save on successful create with minimal fields', () => {
    const saveSpy = jest.spyOn(component.save, 'emit');
    component.bccForm.patchValue({ name: 'New BCC', status: 'active' });
    component.onSubmit();
    expect(service.createBCC).toHaveBeenCalled();
    expect(saveSpy).toHaveBeenCalled();
  });

  it('shows error when submit invalid form', () => {
    component.bccForm.reset();
    component.onSubmit();
    expect(component.bccForm.valid).toBe(false);
  });

  it('calls update on edit mode', () => {
    const saveSpy = jest.spyOn(component.save, 'emit');
    component.bcc = { id: '123', name: 'Existing', status: 'inactive' } as any;
    component.ngOnInit();
    component.bccForm.patchValue({ name: 'Updated Name' });
    component.onSubmit();
    expect(service.updateBCC).toHaveBeenCalledWith('123', expect.objectContaining({ name: 'Updated Name' }));
    expect(saveSpy).toHaveBeenCalled();
  });

  it('handles API error gracefully', () => {
    const errorService = TestBed.inject(BCCService) as unknown as BCCServiceMock;
    (errorService.createBCC as any) = jest.fn(() => throwError(() => ({ error: { message: 'Failed' } })));
    component.bccForm.patchValue({ name: 'Err', status: 'active' });
    component.onSubmit();
    expect(component.error).toBe('Failed');
  });
});


