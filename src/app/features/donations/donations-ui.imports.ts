import { CfActionIconComponent } from '@shared/components/cf-action-icon/cf-action-icon.component';
import { CfStewardshipIconBtnComponent } from '@shared/components/cf-stewardship-icon-btn/cf-stewardship-icon-btn.component';
import { CfStewardshipIconLinkComponent } from '@shared/components/cf-stewardship-icon-link/cf-stewardship-icon-link.component';

/** Shared icon action controls for Donations templates (icon-only + tooltip). */
export const DONATIONS_ICON_UI = [
  CfActionIconComponent,
  CfStewardshipIconBtnComponent,
  CfStewardshipIconLinkComponent,
] as const;
