import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { BishopFormModalComponent } from './bishop-form-modal.component';
import { BishopService } from '@core/services/ecclesiastical/bishop.service';
import { DioceseService } from '@core/services/ecclesiastical/diocese.service';
import { EcclesiasticalTitleService } from '@core/services/ecclesiastical/ecclesiastical-title.service';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';
import { Bishop } from '@core/models/ecclesiastical';

describe('BishopFormModalComponent', () => {
  let component: BishopFormModalComponent;
  let fixture: ComponentFixture<BishopFormModalComponent>;

  const dioceses = [
    { id: 10, name: 'Diocese of Quilon', country: { name: 'India' } },
    { id: 11, name: 'Archdiocese of Verapoly', country: { name: 'India' } },
  ];

  const createdBishop: Bishop = {
    id: 42,
    full_name: 'Most Rev. QA Bishop',
    status: 'active',
    is_current: true,
    archdiocese_id: 10,
  } as Bishop;

  const bishopServiceStub = {
    createBishop: jest.fn().mockReturnValue(of({ success: true, data: createdBishop })),
    updateBishop: jest.fn().mockReturnValue(of({ success: true, data: createdBishop })),
    getBishop: jest.fn().mockReturnValue(of({ success: true, data: createdBishop })),
    uploadPhoto: jest.fn().mockReturnValue(of({ success: true, data: { photo_public_url: 'https://example.com/uploaded.jpg' } })),
    deletePhoto: jest.fn().mockReturnValue(of({ success: true, data: null })),
  } as unknown as BishopService;

  const dioceseServiceStub = {
    getDioceseOptions: jest.fn().mockReturnValue(of(dioceses)),
  } as unknown as DioceseService;

  const titleServiceStub = {
    getTitleOptions: jest.fn().mockReturnValue(of([
      { id: 3, title: 'Archbishop' },
      { id: 4, title: 'Bishop' },
    ])),
  } as unknown as EcclesiasticalTitleService;

  const toastStub = {
    success: jest.fn(),
    error: jest.fn(),
  } as unknown as ToastService;

  const authStub = {
    hasPermission: jest.fn().mockReturnValue(true),
    hasEcclesiasticalPermission: jest.fn().mockReturnValue(true),
  } as unknown as AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [BishopFormModalComponent],
      providers: [
        { provide: BishopService, useValue: bishopServiceStub },
        { provide: DioceseService, useValue: dioceseServiceStub },
        { provide: EcclesiasticalTitleService, useValue: titleServiceStub },
        { provide: ToastService, useValue: toastStub },
        { provide: AuthService, useValue: authStub },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(BishopFormModalComponent);
    component = fixture.componentInstance;
    component.show = true;
    fixture.detectChanges();
  });

  it('should create with create modal title', () => {
    expect(component).toBeTruthy();
    expect(component.modalTitle).toBe('Create New Bishop');
    expect(component.submitButtonText).toBe('Create');
  });

  it('should load diocese options on init', () => {
    expect(dioceseServiceStub.getDioceseOptions).toHaveBeenCalled();
    expect(component.dioceses).toEqual(dioceses);
    expect(component.loadingDioceses).toBe(false);
  });

  it('should initialize form defaults for create mode', () => {
    expect(component.bishopForm.get('status')?.value).toBe('active');
    expect(component.bishopForm.get('full_name')?.value).toBe('');
    expect(component.bishopForm.get('archdiocese_id')?.value).toBeNull();
  });

  it('should reset form when modal opens in create mode', () => {
    component.bishopForm.patchValue({
      full_name: 'Stale Bishop',
      archdiocese_id: 10,
      email: 'stale@example.com',
    });

    component.ngOnChanges({
      show: {
        currentValue: true,
        previousValue: false,
        firstChange: false,
        isFirstChange: () => false,
      },
    });

    expect(component.bishopForm.get('full_name')?.value).toBeNull();
    expect(component.bishopForm.get('status')?.value).toBe('active');
    expect(component.isEditMode).toBe(false);
  });

  it('should block submit and mark touched when required fields are missing', () => {
    component.onSubmit();

    expect(bishopServiceStub.createBishop).not.toHaveBeenCalled();
    expect(component.bishopForm.get('full_name')?.touched).toBe(true);
    expect(component.bishopForm.get('archdiocese_id')?.touched).toBe(true);
  });

  it('should submit valid create payload without empty fields', () => {
    const savedSpy = jest.spyOn(component.saved, 'emit');
    const cancelledSpy = jest.spyOn(component.cancelled, 'emit');

    component.bishopForm.patchValue({
      full_name: 'Most Rev. QA Bishop',
      archdiocese_id: 10,
      ecclesiastical_title_id: 2,
      status: 'active',
      date_of_birth: '1955-03-15',
      ordained_priest_date: '1980-06-01',
      ordained_bishop_date: '2005-09-09',
      appointed_date: '2006-01-01',
      email: 'bishop@example.com',
      phone: '9876543210',
      photo_url: 'https://example.com/photo.jpg',
      education: 'STB, Rome',
      given_name: '',
      family_name: '',
      religious_name: '',
    });

    component.onSubmit();

    expect(bishopServiceStub.createBishop).toHaveBeenCalledWith({
      full_name: 'Most Rev. QA Bishop',
      archdiocese_id: 10,
      ecclesiastical_title_id: 2,
      status: 'active',
      date_of_birth: '1955-03-15',
      ordained_priest_date: '1980-06-01',
      ordained_bishop_date: '2005-09-09',
      appointed_date: '2006-01-01',
      email: 'bishop@example.com',
      phone: '9876543210',
      photo_url: 'https://example.com/photo.jpg',
      education: 'STB, Rome',
      is_current: true,
    });
    expect(bishopServiceStub.getBishop).toHaveBeenCalledWith(createdBishop.id);
    expect(toastStub.success).toHaveBeenCalledWith('Bishop created successfully');
    expect(savedSpy).toHaveBeenCalledWith(createdBishop);
    expect(cancelledSpy).toHaveBeenCalled();
  });

  it('should reject invalid email on frontend', () => {
    component.bishopForm.patchValue({
      full_name: 'Most Rev. QA Bishop',
      archdiocese_id: 10,
      email: 'invalid-email',
    });

    component.onSubmit();

    expect(bishopServiceStub.createBishop).not.toHaveBeenCalled();
    expect(component.hasError('email')).toBe(true);
  });

  it('should reject non-numeric phone on frontend', () => {
    component.bishopForm.patchValue({
      full_name: 'Most Rev. QA Bishop',
      archdiocese_id: 10,
      phone: '+91-98765',
    });

    component.onSubmit();

    expect(bishopServiceStub.createBishop).not.toHaveBeenCalled();
    expect(component.hasError('phone')).toBe(true);
  });

  it('should keep modal open and show error toast on API failure', () => {
    (bishopServiceStub.createBishop as jest.Mock).mockReturnValueOnce(
      throwError(() => ({ status: 422 }))
    );

    component.bishopForm.patchValue({
      full_name: 'Most Rev. QA Bishop',
      archdiocese_id: 10,
    });

    component.onSubmit();

    expect(toastStub.error).toHaveBeenCalledWith('Failed to create bishop');
    expect(component.isSubmitting).toBe(false);
  });

  it('should prevent double submission while request is in flight', () => {
    component.bishopForm.patchValue({
      full_name: 'Most Rev. QA Bishop',
      archdiocese_id: 10,
    });
    component.isSubmitting = true;

    component.onSubmit();

    expect(bishopServiceStub.createBishop).not.toHaveBeenCalled();
  });

  it('should show edit modal title and call update in edit mode', () => {
    component.bishop = {
      id: 5,
      full_name: 'Existing Bishop',
      archdiocese_id: 10,
      status: 'active',
      is_current: false,
    } as Bishop;

    component.ngOnChanges({
      bishop: {
        currentValue: component.bishop,
        previousValue: null,
        firstChange: true,
        isFirstChange: () => true,
      },
    });

    expect(component.modalTitle).toBe('Edit Bishop');
    expect(component.submitButtonText).toBe('Update');
    expect(component.bishopForm.get('full_name')?.value).toBe('Existing Bishop');

    component.onSubmit();

    expect(bishopServiceStub.updateBishop).toHaveBeenCalled();
    expect(bishopServiceStub.createBishop).not.toHaveBeenCalled();
  });

  it('should reset form and emit cancelled on cancel', () => {
    const cancelledSpy = jest.spyOn(component.cancelled, 'emit');

    component.bishopForm.patchValue({
      full_name: 'Temporary Bishop',
      archdiocese_id: 10,
    });

    component.onCancel();

    expect(component.bishopForm.get('full_name')?.value).toBeNull();
    expect(component.isSubmitting).toBe(false);
    expect(cancelledSpy).toHaveBeenCalled();
  });

  it('should show diocese load error toast when dropdown API fails', () => {
    (dioceseServiceStub.getDioceseOptions as jest.Mock).mockReturnValueOnce(
      throwError(() => new Error('network'))
    );

    component.loadDropdownData();

    expect(toastStub.error).toHaveBeenCalledWith('Failed to load dioceses');
    expect(component.dioceses).toEqual([]);
  });

  it('should match diocese dropdown search against name and country', () => {
    expect(component.searchDiocese('quilon', {
      id: 1,
      name: 'Diocese of Quilon',
      country: { name: 'India' },
    } as any)).toBe(true);

    expect(component.searchDiocese('quilon', {
      id: 2,
      name: 'Archdiocese of Verapoly',
      country: { name: 'India' },
    } as any)).toBe(false);

    expect(component.searchDiocese('india', {
      id: 1,
      name: 'Diocese of Quilon',
      country: { name: 'India' },
    } as any)).toBe(true);
  });
});
