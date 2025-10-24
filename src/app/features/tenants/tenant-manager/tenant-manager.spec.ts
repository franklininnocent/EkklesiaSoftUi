import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TenantManager } from './tenant-manager';

describe('TenantManager', () => {
  let component: TenantManager;
  let fixture: ComponentFixture<TenantManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TenantManager]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TenantManager);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
