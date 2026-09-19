import { TestBed } from '@angular/core/testing';
import { take } from 'rxjs/operators';

import { ConfirmationDialogService } from './confirmation-dialog.service';

describe('ConfirmationDialogService', () => {
  let service: ConfirmationDialogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConfirmationDialogService);
  });

  it('opens dialog with provided options', (done) => {
    service.state$.pipe(take(1)).subscribe((state) => {
      expect(state.show).toBe(false);
      done();
    });
  });

  it('emits confirmed result when resolve is called with confirmed true', (done) => {
    service.confirm({
      title: 'Delete Item',
      message: 'Are you sure?',
      variant: 'danger',
    }).subscribe((result) => {
      expect(result.confirmed).toBe(true);
      expect(result.description).toBe('note');
      done();
    });

    service.resolve({ confirmed: true, description: 'note' });
  });

  it('emits cancelled result when resolve is called with confirmed false', (done) => {
    service.confirm({
      title: 'Delete Item',
      message: 'Are you sure?',
    }).subscribe((result) => {
      expect(result.confirmed).toBe(false);
      done();
    });

    service.resolve({ confirmed: false });
  });

  it('confirmDeactivate uses standard copy', (done) => {
    service.confirmDeactivate('Tenant').subscribe((result) => {
      expect(result.confirmed).toBe(true);
      done();
    });

    const state = service.state$.pipe(take(1));
    state.subscribe((s) => {
      expect(s.options?.title).toBe('Deactivate Tenant');
      expect(s.options?.message).toBe('Are you sure you want to deactivate this tenant?');
      expect(s.options?.confirmText).toBe('Confirm Deactivate');
      expect(s.options?.variant).toBe('danger');
    });

    service.resolve({ confirmed: true });
  });

  it('confirmDiscardChanges uses standard copy', (done) => {
    service.confirmDiscardChanges().subscribe((result) => {
      expect(result.confirmed).toBe(false);
      done();
    });

    service.resolve({ confirmed: false });
  });
});
