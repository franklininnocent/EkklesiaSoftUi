import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideMockStore, MockStore } from '@ngrx/store/testing';
import { of, throwError } from 'rxjs';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { SacramentFormModalComponent } from './sacrament-form-modal.component';
import { SacramentService } from '../../services/sacrament.service';
import { ToastService } from '@core/services/toast.service';
import { TenantService } from '@core/services/tenant.service';
import { BCCService } from '@core/services/bcc.service';
import { FamilyService } from '@core/services/family.service';
import { ChurchLeadershipService } from '@core/services/church/church-leadership.service';
import { SacramentDefinitionService } from '../../services/sacrament-definition.service';
import { ParishPersonService } from '../../services/person.service';
import { selectCurrentUser } from '@core/store/auth/auth.selectors';

describe('SacramentFormModalComponent', () => {
  let component: SacramentFormModalComponent;
  let fixture: ComponentFixture<SacramentFormModalComponent>;
  let store: MockStore;

  const sacramentTypes = [
    { id: 1, name: 'Baptism', code: 'BAPTISM' },
    { id: 2, name: 'Confirmation', code: 'CONFIRMATION' },
    { id: 3, name: 'Marriage', code: 'MARRIAGE' },
    { id: 4, name: 'Eucharist', code: 'EUCHARIST' }
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

  const tenantStub = {
    getChurchProfile: jasmine.createSpy('getChurchProfile').and.returnValue(of({
      success: true,
      data: { name: 'St. Mary Parish' }
    }))
  } as unknown as TenantService;

  const leadershipStub = {
    getLeaders: jasmine.createSpy('getLeaders').and.returnValue(of({ success: true, data: [] }))
  };

  const bccStub = {
    getBCCs: jasmine.createSpy('getBCCs').and.returnValue(of({ success: true, data: [] }))
  };

  const familyStub = {
    getFamilies: jasmine.createSpy('getFamilies').and.returnValue(of({ success: true, data: [] })),
    getFamiliesByBCC: jasmine.createSpy('getFamiliesByBCC').and.returnValue(of({ success: true, data: [] })),
    getFamilyMembers: jasmine.createSpy('getFamilyMembers').and.returnValue(of({ success: true, data: [] }))
  };

  const personStub = {
    search: jasmine.createSpy('search').and.returnValue(of({ success: true, data: [] })),
    get: jasmine.createSpy('get').and.returnValue(of({ success: true, data: {} })),
    matches: jasmine.createSpy('matches').and.returnValue(of({ success: true, data: [] }))
  };

  const definitionStub = {
    load: jasmine.createSpy('load').and.returnValue(of({
      success: true,
      data: [{
        code: 'BAPTISM',
        workflow: 'progressive',
        batch_supported: true,
        privacy_class: 'standard',
        certificate_supported: true,
        review_required: false,
        minister_roles: ['priest'],
        participants: [],
        fields: { minimum: [], recommended: [], complete: [] }
      }],
      meta: { participants_v1: true }
    })),
    getByCode: jasmine.createSpy('getByCode').and.returnValue(of({
      code: 'BAPTISM',
      workflow: 'progressive',
      batch_supported: true,
      privacy_class: 'standard',
      certificate_supported: true,
      review_required: false,
      minister_roles: ['priest'],
      participants: [],
      fields: { minimum: [], recommended: [], complete: [] }
    })),
    isParticipantsV1Enabled: () => true,
    clearCache: () => undefined
  } as unknown as SacramentDefinitionService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SacramentFormModalComponent],
      providers: [
        { provide: SacramentService, useValue: sacramentServiceStub },
        { provide: ToastService, useValue: toastStub },
        { provide: TenantService, useValue: tenantStub },
        { provide: ChurchLeadershipService, useValue: leadershipStub },
        { provide: BCCService, useValue: bccStub },
        { provide: FamilyService, useValue: familyStub },
        { provide: ParishPersonService, useValue: personStub },
        { provide: SacramentDefinitionService, useValue: definitionStub },
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
    expect((sacramentServiceStub.getSacramentTypes as any)).toHaveBeenCalledWith({ includeInactive: false });
    expect(component.sacramentTypes.length).toBe(4);
  });

  it('omits tenant-inactive types from the create selector', () => {
    const spy = sacramentServiceStub.getSacramentTypes as any;
    spy.and.returnValue(of({
      success: true,
      data: [
        { id: 1, name: 'Baptism', code: 'BAPTISM', enabled_for_tenant: true },
        { id: 3, name: 'Marriage', code: 'MARRIAGE', enabled_for_tenant: false },
      ]
    }));
    component.isEditMode = false;
    component.loadSacramentTypes();
    expect(component.sacramentTypes.map((type) => type.id)).toEqual([1]);
    expect(component.showNoActiveSacramentsMessage).toBe(false);
    spy.and.returnValue(of({ success: true, data: sacramentTypes }));
    component.loadSacramentTypes();
  });

  it('shows an empty message when this church has no active sacraments', () => {
    const spy = sacramentServiceStub.getSacramentTypes as any;
    spy.and.returnValue(of({
      success: true,
      data: [
        { id: 3, name: 'Marriage', code: 'MARRIAGE', enabled_for_tenant: false },
      ]
    }));
    component.isEditMode = false;
    component.loadSacramentTypes();
    expect(component.sacramentTypes).toEqual([]);
    expect(component.showNoActiveSacramentsMessage).toBe(true);
    expect(component.canSelectSacramentType).toBe(false);
    expect(component.canSubmitSacrament).toBe(false);
    spy.and.returnValue(of({ success: true, data: sacramentTypes }));
    component.loadSacramentTypes();
  });

  it('keeps the current type when editing a historical inactive sacrament', () => {
    const spy = sacramentServiceStub.getSacramentTypes as any;
    spy.and.returnValue(of({
      success: true,
      data: [
        { id: 1, name: 'Baptism', code: 'BAPTISM', enabled_for_tenant: true },
        { id: 3, name: 'Marriage', code: 'MARRIAGE', enabled_for_tenant: false },
      ]
    }));
    component.isEditMode = true;
    component.sacrament = { id: 9, sacrament_type_id: 3 } as any;
    component.loadSacramentTypes();
    expect(component.sacramentTypes.map((type) => type.id)).toEqual([1, 3]);
    expect(component.showNoActiveSacramentsMessage).toBe(false);
    spy.and.returnValue(of({ success: true, data: sacramentTypes }));
    component.loadSacramentTypes();
  });

  it('surfaces a retryable error when sacrament types fail to load', () => {
    const spy = sacramentServiceStub.getSacramentTypes as any;
    spy.and.returnValue(throwError(() => new Error('network')));
    component.loadSacramentTypes();
    expect(component.sacramentTypesError).toBeTruthy();
    expect(component.canSelectSacramentType).toBe(false);
    expect((toastStub.error as any)).toHaveBeenCalled();
    spy.and.returnValue(of({ success: true, data: sacramentTypes }));
    component.loadSacramentTypes();
    expect(component.sacramentTypesError).toBeNull();
    expect(component.sacramentTypes.length).toBe(4);
  });

  it('requiresParents should apply to Baptism and Eucharist', () => {
    component.formData['sacrament_type_id'] = 1; // Baptism
    expect(component.requiresParents()).toBe(true);
    component.formData['sacrament_type_id'] = 4; // Eucharist
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

    // Baptism requires minister plus place, DOB, birth place, gender, and parents
    component.formData = {
      sacrament_type_id: 1,
      recipient_name: 'John',
      date_administered: '2025-01-01',
      minister_name: 'Fr. Thomas'
    } as any;
    expect(component.validateForm()).toBe(false);

    component.formData = {
      sacrament_type_id: 1,
      recipient_name: 'John',
      date_administered: '2025-01-01',
      minister_name: 'Fr. Thomas',
      place_administered: 'St. Mary',
      recipient_birth_date: '2015-01-01',
      recipient_birth_place: 'Parish City',
      recipient_gender: 'male',
      father_name: 'Joseph',
      mother_name: 'Mary'
    } as any;
    expect(component.validateForm()).toBe(true);

    component.formData = { sacrament_type_id: 2, recipient_name: 'John', date_administered: '2025-01-01' } as any;
    expect(component.validateForm()).toBe(true);

    component.formData = {
      sacrament_type_id: 3,
      date_administered: '2025-06-15',
      minister_name: 'Fr. Thomas',
      marriage_bride_full_name: 'Jane Bride',
      marriage_groom_full_name: 'John Groom'
    } as any;
    component.brideDraft = { role: 'bride', source: 'external', external_full_name: 'Jane Bride' } as any;
    component.groomDraft = { role: 'groom', source: 'external', external_full_name: 'John Groom' } as any;
    expect(component.validateForm()).toBe(false);

    component.formData['place_administered'] = 'St. Mary';
    component.brideDraft = {
      role: 'bride',
      source: 'external',
      external_full_name: 'Jane Bride',
      external_date_of_birth: '1990-01-01',
      external_gender: 'female'
    } as any;
    component.groomDraft = {
      role: 'groom',
      source: 'external',
      external_full_name: 'John Groom',
      external_date_of_birth: '1988-02-02',
      external_gender: 'male'
    } as any;
    expect(component.validateForm()).toBe(true);
  });

  it('should require marriage witness name, address, gender, and contact but not date of birth', () => {
    component.formData = {
      sacrament_type_id: 3,
      date_administered: '2025-06-15',
      place_administered: 'St. Mary',
      minister_name: 'Fr. Thomas'
    } as any;
    component.brideDraft = {
      role: 'bride',
      source: 'external',
      external_full_name: 'Jane Bride',
      external_date_of_birth: '1990-01-01',
      external_gender: 'female'
    } as any;
    component.groomDraft = {
      role: 'groom',
      source: 'external',
      external_full_name: 'John Groom',
      external_date_of_birth: '1988-02-02',
      external_gender: 'male'
    } as any;
    component.ministerDraft = {
      role: 'minister',
      source: 'external',
      external_full_name: 'Fr. Thomas'
    } as any;

    component.witnessDrafts = [{ role: 'witness', source: 'external' } as any];
    expect(component.validateForm()).toBe(true);

    component.witnessDrafts = [{
      role: 'witness',
      source: 'external',
      external_full_name: 'Pat Witness'
    } as any];
    expect(component.validateForm()).toBe(false);
    expect(component.fieldErrors['witness_0']).toContain('address');
    expect(component.fieldErrors['witness_0']).toContain('gender');
    expect(component.fieldErrors['witness_0']).toContain('contact number');
    expect(component.fieldErrors['witness_0']).not.toContain('date of birth');

    component.witnessDrafts = [{
      role: 'witness',
      source: 'external',
      external_full_name: 'Pat Witness',
      external_address: '12 Oak Lane',
      external_gender: 'female',
      external_contact_number: '5550100'
    } as any];
    expect(component.validateForm()).toBe(true);
  });

  it('should call create on save when not in edit mode', () => {
    component.isEditMode = false;
    component.currentTenantId = 10;
    component.formData = {
      sacrament_type_id: 2,
      recipient_name: 'Jane',
      date_administered: '2025-01-01'
    } as any;
    component.onSave();
    expect((sacramentServiceStub.createSacrament as any)).toHaveBeenCalled();
  });

  it('should call update on save when in edit mode', () => {
    component.isEditMode = true;
    component.sacrament = { id: 77 } as any;
    component.currentTenantId = 10;
    component.formData = { sacrament_type_id: 2, recipient_name: 'Paul', date_administered: '2025-01-02' } as any;
    component.onSave();
    expect((sacramentServiceStub.updateSacrament as any)).toHaveBeenCalledWith(77, jasmine.any(Object));
  });
});
