import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TenantCreateModal } from './tenant-create-modal';

describe('TenantCreateModal', () => {
  let component: TenantCreateModal;
  let fixture: ComponentFixture<TenantCreateModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenantCreateModal]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TenantCreateModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
