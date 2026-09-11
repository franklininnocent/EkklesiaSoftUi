import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MemberListComponent } from './member-list.component';
import { MemberService } from '../../services/member.service';
import { BCCService } from '@core/services/bcc.service';
import { ToastService } from '@core/services/toast.service';
import { FamilyMember } from '@core/models/family.model';

describe('MemberListComponent (list photos)', () => {
  const routerStub = { navigate: jest.fn() };
  const routeStub = {
    snapshot: { queryParamMap: convertToParamMap({}) },
    queryParamMap: of(convertToParamMap({})),
  };

  const configure = () => {
    const mockMemberService = {
      getMembers: jest.fn(() => of({ data: [], current_page: 1, last_page: 1, total: 0 })),
    };
    const mockBccService = { getBCCs: jest.fn(() => of({ data: [] })) };

    TestBed.configureTestingModule({
      imports: [MemberListComponent],
      providers: [
        { provide: MemberService, useValue: mockMemberService },
        { provide: BCCService, useValue: mockBccService },
        { provide: Router, useValue: routerStub },
        { provide: ActivatedRoute, useValue: routeStub },
        { provide: ToastService, useValue: { error: jest.fn(), success: jest.fn() } },
      ],
    });
  };

  const headMember = (): FamilyMember =>
    ({
      id: 'm-head',
      family_id: 'f1',
      first_name: 'Lucas',
      last_name: 'Williams',
      relationship_to_head: 'self',
      status: 'active',
      family: {
        id: 'f1',
        tenant_id: 't1',
        family_code: 'F-001',
        family_name: 'Williams',
        head_profile_image_full_url: 'https://example.com/lucas.jpg',
      },
    }) as FamilyMember;

  const childMember = (): FamilyMember =>
    ({
      id: 'm-child',
      family_id: 'f1',
      first_name: 'Mia',
      last_name: 'Williams',
      relationship_to_head: 'daughter',
      status: 'active',
      family: {
        id: 'f1',
        tenant_id: 't1',
        family_code: 'F-001',
        family_name: 'Williams',
        head_profile_image_full_url: 'https://example.com/lucas.jpg',
      },
    }) as FamilyMember;

  it('resolves the nested family head photo URL for family heads only', () => {
    configure();
    const fixture = TestBed.createComponent(MemberListComponent);
    const component = fixture.componentInstance;

    expect(component.getMemberPhotoUrl(headMember())).toBe('https://example.com/lucas.jpg');
    expect(component.getMemberPhotoUrl(childMember())).toBeNull();
  });

  it('opens the shared viewer from the list without nesting', () => {
    configure();
    const fixture = TestBed.createComponent(MemberListComponent);
    const component = fixture.componentInstance;
    const event = { stopPropagation: jest.fn(), preventDefault: jest.fn() } as unknown as Event;

    component.openPhotoViewer(headMember(), event, false);

    expect(event.stopPropagation).toHaveBeenCalled();
    expect(component.photoViewer?.src).toBe('https://example.com/lucas.jpg');
    expect(component.photoViewer?.title).toBe('Lucas Williams');
    expect(component.photoViewer?.nested).toBe(false);
  });

  it('opens a nested viewer from the member detail modal', () => {
    configure();
    const fixture = TestBed.createComponent(MemberListComponent);
    const component = fixture.componentInstance;
    const event = { stopPropagation: jest.fn(), preventDefault: jest.fn() } as unknown as Event;

    component.openPhotoViewer(headMember(), event, true);

    expect(component.photoViewer?.nested).toBe(true);
  });

  it('falls back to initials after a broken image', () => {
    configure();
    const fixture = TestBed.createComponent(MemberListComponent);
    const component = fixture.componentInstance;
    const member = headMember();

    expect(component.getMemberPhotoUrl(member)).toBe('https://example.com/lucas.jpg');
    component.onAvatarError(member);
    expect(component.isAvatarBroken(member)).toBe(true);
    expect(component.getMemberPhotoUrl(member)).toBeNull();
  });
});
