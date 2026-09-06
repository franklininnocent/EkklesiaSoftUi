import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of } from 'rxjs';
import { UserFormModalComponent } from './user-form-modal.component';
import { UsersService } from '@core/services/users.service';
import { RolesService } from '@core/services/roles.service';
import { ToastService } from '@core/services/toast.service';

describe('UserFormModalComponent', () => {
  let component: UserFormModalComponent;
  let fixture: ComponentFixture<UserFormModalComponent>;

  const roles = [
    { id: 1, name: 'Admin', level: 1, active: 1, is_custom: true, permissions: [] },
    { id: 2, name: 'Editor', level: 2, active: 1, is_custom: true, permissions: [] }
  ];

  const usersServiceStub = {
    createUser: jasmine.createSpy('createUser').and.returnValue(of({ success: true, data: {} })),
    updateUser: jasmine.createSpy('updateUser').and.returnValue(of({ success: true, data: {} })),
    getLinkableClergy: jasmine.createSpy('getLinkableClergy').and.returnValue(of({ success: true, data: [] }))
  } as unknown as UsersService;

  const rolesServiceStub = {
    getRoles: jasmine.createSpy('getRoles').and.returnValue(of({ success: true, data: roles }))
  } as unknown as RolesService;

  const toastStub = {
    success: jasmine.createSpy('success'),
    error: jasmine.createSpy('error')
  } as unknown as ToastService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserFormModalComponent],
      providers: [
        { provide: UsersService, useValue: usersServiceStub },
        { provide: RolesService, useValue: rolesServiceStub },
        { provide: ToastService, useValue: toastStub }
      ],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(UserFormModalComponent);
    component = fixture.componentInstance;
    component.show = true;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load roles on init', () => {
    expect((rolesServiceStub.getRoles as any)).toHaveBeenCalled();
    expect(component.availableRoles.length).toBe(2);
  });

  it('should validate required fields for create mode', () => {
    component.isEditMode = false;
    component.formData = {
      name: '',
      email: '',
      password: '',
      password_confirmation: '',
      contact_number: '',
      user_type: 1,
      role_ids: [],
      active: 1,
      person_id: null
    };

    component.isFormValid();
    expect(component.validationErrors['name']).toBeDefined();
    expect(component.validationErrors['email']).toBeDefined();
    expect(component.validationErrors['password']).toBeDefined();
    expect(component.validationErrors['role_ids']).toBeDefined();
  });

  it('should require strong password and matching confirmation', () => {
    component.isEditMode = false;
    component.formData.password = 'weak';
    component.formData.password_confirmation = 'weak2';
    component.validateField('password');
    component.validateField('password_confirmation');
    expect(component.validationErrors['password']).toBeDefined();
    expect(component.validationErrors['password_confirmation']).toBeDefined();

    component.formData.password = 'Strong1!';
    component.formData.password_confirmation = 'Strong1!';
    component.validateField('password');
    component.validateField('password_confirmation');
    expect(component.validationErrors['password']).toBeUndefined();
    expect(component.validationErrors['password_confirmation']).toBeUndefined();
  });

  it('should not require password in edit mode', () => {
    component.isEditMode = true;
    component.user = {
      id: 10,
      name: 'Edit User',
      email: 'edit@example.com',
      active: 1,
      roles: [],
      is_primary_admin: false
    } as any;
    component.ngOnChanges({ show: { currentValue: true, previousValue: false, firstChange: false, isFirstChange: () => false } as any });
    component.formData.password = '';
    component.validateField('password');
    expect(component.validationErrors['password']).toBeUndefined();
  });

  it('should require at least one role', () => {
    component.selectedRoleIds.clear();
    component.validateField('role_ids');
    expect(component.validationErrors['role_ids']).toBeDefined();

    component.toggleRole(roles[0].id);
    component.validateField('role_ids');
    expect(component.validationErrors['role_ids']).toBeUndefined();
  });
});


