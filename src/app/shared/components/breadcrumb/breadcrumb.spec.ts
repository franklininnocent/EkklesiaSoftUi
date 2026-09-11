import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { BreadcrumbComponent } from './breadcrumb';

describe('BreadcrumbComponent', () => {
  let component: BreadcrumbComponent;
  let fixture: ComponentFixture<BreadcrumbComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BreadcrumbComponent, RouterTestingModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BreadcrumbComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('labels ministries segments in plain language', () => {
    const labels = (component as unknown as { getRouteLabel(route: string): string });
    expect(labels.getRouteLabel('ministries')).toBe('Ministries & Associations');
    expect(labels.getRouteLabel('guests')).toBe('Guest members');
    expect(labels.getRouteLabel('audit')).toBe('Audit log');
  });
});
