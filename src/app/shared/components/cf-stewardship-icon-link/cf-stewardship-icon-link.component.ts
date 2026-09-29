import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CfActionIconComponent, CfActionIconName } from '../cf-action-icon/cf-action-icon.component';

@Component({
  selector: 'app-cf-stewardship-icon-link',
  standalone: true,
  imports: [RouterModule, CfActionIconComponent],
  template: `
    <a
      class="cf-btn cf-btn-icon"
      [class.cf-btn-primary]="variant === 'primary'"
      [class.cf-btn--sm]="size === 'sm'"
      [routerLink]="routerLink"
      [attr.aria-label]="label"
      [attr.title]="title || label"
    >
      <app-cf-action-icon [name]="icon" />
    </a>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CfStewardshipIconLinkComponent {
  @Input({ required: true }) icon!: CfActionIconName;
  @Input({ required: true }) label!: string;
  @Input({ required: true }) routerLink!: string | string[];
  @Input() title = '';
  @Input() variant: 'default' | 'primary' = 'default';
  @Input() size: 'md' | 'sm' = 'md';
}
