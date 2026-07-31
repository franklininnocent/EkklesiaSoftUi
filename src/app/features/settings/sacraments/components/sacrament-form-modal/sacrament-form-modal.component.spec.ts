import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { SacramentFormModalComponent } from './sacrament-form-modal.component';
import { SacramentService } from '../../services/sacrament.service';
import { ToastService } from '@core/services/toast.service';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';

describe('SacramentFormModalComponent', () => {
  let component: SacramentFormModalComponent;
  let fixture: ComponentFixture<SacramentFormModalComponent>;
  let store: MockStore;

  const sacramentTypes = [
    { id: 1, name: 'Baptism', code: 'BAPTISM' },
    { id: 2, name: 'Confirmation', code: 'CONFIRMATION' },
    { id: 3, name: 'Marriage', code: 'MARRIAGE' }
  ];

  const sacramentServiceStub = {
    getSacramentTypes: jasmine.createSpy('getSacramentTypes').and.returnValue(of({ success: true, data: sacramentTypes })),
    createSacrament: jasmine.createSpy('createSacrament').and.returnValue(of({ success: true })),
    updateSacrament: jasmine.createSpy('updateSacrament').and.returnValue(of({ success: true }))
  } as unknown as SacramentService;

  const toastStub = {
    success: jasmine.createSpy('success'),
    error: jasmine.createSpy('error')
  } as unknown as ToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SacramentFormModalComponent],
      providers: [
        { provide: SacramentService, useValue: sacramentServiceStub },
        { provide: ToastService, useValue: toastStub },
        provideMockStore({ initialState: {} })
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    store = TestBed.inject(MockStore);
    store.overrideSelector(selectCurrentUser, { id: 1, tenant_id: 10 } as any);

    fixture = TestBed.createComponent(SacramentFormModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load sacrament types on init', () => {
    expect((sacramentServiceStub.getSacramentTypes as any)).toHaveBeenCalled();
    expect(component.sacramentTypes.length).toBe(3);
  });

  it('requiresParents should depend on type BAPTISM', () => {
    component.formData['sacrament_type_id'] = 1; // Baptism
    expect(component.requiresParents()).toBe(true);
    component.formData['sacrament_type_id'] = 3; // Marriage
    expect(component.requiresParents()).toBe(false);
  });

  it('requiresGodparents should depend on types BAPTISM and CONFIRMATION', () => {
    component.formData['sacrament_type_id'] = 1; // Baptism
    expect(component.requiresGodparents()).toBe(true);
    component.formData['sacrament_type_id'] = 2; // Confirmation
    expect(component.requiresGodparents()).toBe(true);
    component.formData['sacrament_type_id'] = 3; // Marriage
    expect(component.requiresGodparents()).toBe(false);
  });

  it('validateForm should enforce required fields', () => {
    component.formData = { sacrament_type_id: undefined, recipient_name: '', date_administered: '' } as any;
    expect(component.validateForm()).toBe(false);
    expect((toastStub.error as any)).toHaveBeenCalled();

    component.formData = { sacrament_type_id: 1, recipient_name: '', date_administered: '' } as any;
    expect(component.validateForm()).toBe(false);

    component.formData = { sacrament_type_id: 1, recipient_name: 'John', date_administered: '' } as any;
    expect(component.validateForm()).toBe(false);

    component.formData = { sacrament_type_id: 2, recipient_name: 'John', date_administered: '2025-01-01' } as any;
    expect(component.validateForm()).toBe(true);
  });

  it('should call create on save when not in edit mode', () => {
    component.isEditMode = false;
    component.formData = { sacrament_type_id: 2, recipient_name: 'Jane', date_administered: '2025-01-01' } as any;
    component.onSave();
    expect((sacramentServiceStub.createSacrament as any)).toHaveBeenCalled();
  });

  it('should call update on save when in edit mode', () => {
    component.isEditMode = true;
    component.sacrament = { id: 77 } as any;
    component.formData = { sacrament_type_id: 2, recipient_name: 'Paul', date_administered: '2025-01-02' } as any;
    component.onSave();
    expect((sacramentServiceStub.updateSacrament as any)).toHaveBeenCalledWith(77, jasmine.any(Object));
  });
});


