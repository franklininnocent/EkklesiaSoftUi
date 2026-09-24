import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BreadcrumbComponent } from './breadcrumb';

@Component({ standalone: true, template: '' })
class BreadcrumbStubComponent {}

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
    expect(labels.getRouteLabel('sacraments')).toBe('Sacraments');
  });
});

describe('BreadcrumbComponent sacrament record trail', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BreadcrumbComponent],
      providers: [
        provideRouter([
          {
            path: 'sacraments',
            children: [
              { path: '', component: BreadcrumbStubComponent },
              {
                path: 'register',
                component: BreadcrumbStubComponent,
                data: { breadcrumbLabel: 'Register' },
              },
              {
                path: 'view/:id',
                component: BreadcrumbStubComponent,
                data: { breadcrumbLabel: 'Record' },
              },
            ],
          },
          {
            path: 'tenant/:tenantId',
            children: [
              {
                path: 'sacraments',
                children: [
                  {
                    path: 'view/:id',
                    component: BreadcrumbStubComponent,
                    data: { breadcrumbLabel: 'Record' },
                  },
                ],
              },
            ],
          },
        ]),
      ],
    }).compileComponents();
  });

  async function labelsAfter(url: string): Promise<BreadcrumbComponent['breadcrumbs']> {
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(BreadcrumbComponent);
    fixture.detectChanges();
    await router.navigateByUrl(url);
    fixture.detectChanges();
    return fixture.componentInstance.breadcrumbs;
  }

  it('inserts Register before a sacrament record', async () => {
    const crumbs = await labelsAfter('/sacraments/view/42');
    expect(crumbs.map((crumb) => crumb.label)).toEqual(['Home', 'Sacraments', 'Register', 'Record']);
    expect(crumbs.find((crumb) => crumb.label === 'Register')?.url).toBe('/sacraments/register');
  });

  it('keeps a single Register crumb on the register itself', async () => {
    const crumbs = await labelsAfter('/sacraments/register');
    expect(crumbs.map((crumb) => crumb.label)).toEqual(['Home', 'Sacraments', 'Register']);
  });

  it('keeps the register crumb inside a tenant-prefixed record URL', async () => {
    const crumbs = await labelsAfter('/tenant/9/sacraments/view/42');
    expect(crumbs.find((crumb) => crumb.label === 'Register')?.url).toBe('/tenant/9/sacraments/register');
    expect(crumbs[crumbs.length - 1].label).toBe('Record');
  });
});
