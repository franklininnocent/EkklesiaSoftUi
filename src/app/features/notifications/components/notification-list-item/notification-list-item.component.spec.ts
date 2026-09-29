import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationListItemComponent } from './notification-list-item.component';
import { UserNotification } from '../../models/notification.model';

describe('NotificationListItemComponent', () => {
  let fixture: ComponentFixture<NotificationListItemComponent>;
  let component: NotificationListItemComponent;

  const item: UserNotification = {
    id: 'n-1',
    title: 'Refund requested',
    body: 'A refund needs your approval.',
    status: 'unread',
    priority: 'high',
    module: 'Donations',
    category: 'operations',
    definition_code: 'donations.refund.requested',
    action_status: 'required',
    is_mention: false,
    actor_display_name: 'Jane Doe',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    read_at: null,
    archived_at: null,
    event_type: 'donations.refund.requested',
    subject_type: 'donation_payment',
    subject_id: 'pay-1',
    subject_status: 'available',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationListItemComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationListItemComponent);
    component = fixture.componentInstance;
    component.item = item;
    fixture.detectChanges();
  });

  it('renders title, body, and action badge', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Refund requested');
    expect(el.textContent).toContain('A refund needs your approval.');
    expect(el.textContent).toContain('Action needed');
  });

  it('emits markRead without bubbling row click', () => {
    const markRead = jest.fn();
    component.markRead.subscribe(markRead);

    const button = fixture.nativeElement.querySelector('.cf-notif-row__mark-read') as HTMLButtonElement;
    button.click();

    expect(markRead).toHaveBeenCalledWith(item);
  });

  it('emits open on row click in compact mode', () => {
    const open = jest.fn();
    component.open.subscribe(open);

    const row = fixture.nativeElement.querySelector('.cf-notif-row__main') as HTMLButtonElement;
    row.click();

    expect(open).toHaveBeenCalledWith(item);
  });
});
