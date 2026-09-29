import { CanDeactivateFn } from '@angular/router';
import { SubscriptionTaxPage } from '../pages/subscription-tax/subscription-tax.page';

export const subscriptionTaxCanDeactivateGuard: CanDeactivateFn<SubscriptionTaxPage> = (component) => {
  if (!(component instanceof SubscriptionTaxPage)) {
    return true;
  }
  return component.canDeactivate();
};
