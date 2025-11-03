import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '@core/services';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-ecclesiastical',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './ecclesiastical.component.html',
  styleUrl: './ecclesiastical.component.scss'
})
export class EcclesiasticalComponent implements OnInit {
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  
  hasEkklesiaRole = false;

  ngOnInit(): void {
    // Check immediately first
    this.checkEkklesiaRole(this.authService.currentUserValue);
    
    // Also subscribe to user changes
    this.authService.currentUser$.pipe(take(1)).subscribe(user => {
      this.checkEkklesiaRole(user);
      this.cdr.detectChanges();
    });
  }

  private checkEkklesiaRole(user: any): void {
    if (!user) {
      this.hasEkklesiaRole = false;
      this.cdr.detectChanges();
      return;
    }

    // Check if user has Ekklesia role flag (primary check)
    if (user.has_ekklesia_role === true) {
      this.hasEkklesiaRole = true;
      this.cdr.detectChanges();
      return;
    }

    // Fallback: Check for Ekklesia roles by name
    const ekklesiaRoles = ['SuperAdmin', 'EkklesiaAdmin', 'EkklesiaManager', 'EkklesiaUser'];
    this.hasEkklesiaRole = 
      ekklesiaRoles.includes(user.role_name || '') ||
      ekklesiaRoles.includes(user.role?.name || '') ||
      this.authService.isEkklesiaAdmin() ||
      this.authService.isSuperAdmin();
    
    // Debug log
    console.log('Ekklesia role check:', {
      hasEkklesiaRole: this.hasEkklesiaRole,
      roleName: user.role_name,
      has_ekklesia_role: user.has_ekklesia_role,
      userId: user.id
    });
    
    this.cdr.detectChanges();
  }
}

