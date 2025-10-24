import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  settingsSections = [
    { title: 'Profile Settings', description: 'Manage your personal information', icon: '👤', route: null },
    { title: 'Security', description: 'Password and authentication settings', icon: '🔒', route: null },
    { title: 'Notifications', description: 'Configure notification preferences', icon: '🔔', route: null },
    { title: 'Billing', description: 'Manage subscription and payment methods', icon: '💳', route: null },
    { title: 'Teams', description: 'Manage team members and roles', icon: '👥', route: null },
    { title: 'Integrations', description: 'Connect third-party services', icon: '🔗', route: null }
  ];

  constructor(private router: Router) {}

  onConfigure(section: any): void {
    if (section.route) {
      this.router.navigate([section.route]);
    } else {
      console.log(`Configure ${section.title} - Coming soon!`);
    }
  }
}

