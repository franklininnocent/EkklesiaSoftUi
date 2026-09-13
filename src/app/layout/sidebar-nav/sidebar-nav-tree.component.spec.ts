import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SidebarNavTreeComponent } from './sidebar-nav-tree.component';
import { DONATIONS_SIDEBAR_TREE } from '@features/donations/config/stewardship-sidebar.adapter';

@Component({ template: '', standalone: true })
class StubPageComponent {}

describe('SidebarNavTreeComponent', () => {
  let fixture: ComponentFixture<SidebarNavTreeComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarNavTreeComponent],
      providers: [
        provideRouter([
          { path: 'donations/campaigns', component: StubPageComponent },
          { path: '**', component: StubPageComponent },
        ]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarNavTreeComponent);
    router = TestBed.inject(Router);
    fixture.componentInstance.root = DONATIONS_SIDEBAR_TREE;
    fixture.detectChanges();
  });

  it('renders donations root with data-nav', () => {
    const root = fixture.nativeElement.querySelector('[data-nav="donations"]');
    expect(root).toBeTruthy();
    expect(root.textContent).toContain('Stewardship & Donations');
  });

  it('auto-expands projects when navigating to campaigns', async () => {
    await router.navigateByUrl('/donations/campaigns');
    fixture.detectChanges();

    expect(fixture.componentInstance.expandedIds.has('donations')).toBe(true);
    expect(fixture.componentInstance.expandedIds.has('donations-projects')).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-nav="donations-projects-campaigns"][aria-current="page"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Campaigns');
  });

  it('closes the previous workspace arrow when another workspace is opened', async () => {
    await router.navigateByUrl('/donations/campaigns');
    fixture.detectChanges();

    const collectToggle = fixture.nativeElement.querySelector(
      '[aria-controls="sidebar-nav-donations-collect"]'
    ) as HTMLButtonElement;
    expect(collectToggle).toBeTruthy();
    collectToggle.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#sidebar-nav-donations-projects')).toBeNull();
    expect(fixture.nativeElement.querySelector('#sidebar-nav-donations-collect')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-controls="sidebar-nav-donations-projects"]')?.getAttribute('aria-expanded')).toBe('false');
    expect(collectToggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('uses block host layout for tree nodes', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(getComputedStyle(host).display).toBe('block');
  });

  it('hides nested items when collapsed', () => {
    fixture.componentInstance.collapsed = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.nav-submenu')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-nav="donations"]')).toBeTruthy();
  });
});
