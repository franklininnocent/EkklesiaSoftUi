import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type FontSize = 'small' | 'standard' | 'large';

export interface FontSizeConfig {
  name: string;
  value: FontSize;
  baseSize: string;
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly FONT_SIZE_KEY = 'ekklesia_font_size';
  
  private fontSizeSubject: BehaviorSubject<FontSize>;
  public fontSize$: Observable<FontSize>;

  public fontSizeOptions: FontSizeConfig[] = [
    {
      name: 'Small',
      value: 'small',
      baseSize: '14px',
      description: 'Compact view with smaller text'
    },
    {
      name: 'Standard',
      value: 'standard',
      baseSize: '16px',
      description: 'Default comfortable reading size'
    },
    {
      name: 'Large',
      value: 'large',
      baseSize: '18px',
      description: 'Larger text for better readability'
    }
  ];

  constructor() {
    const savedFontSize = this.getSavedFontSize();
    this.fontSizeSubject = new BehaviorSubject<FontSize>(savedFontSize);
    this.fontSize$ = this.fontSizeSubject.asObservable();
    
    // Apply the saved font size on initialization
    this.applyFontSize(savedFontSize);
  }

  private getSavedFontSize(): FontSize {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = localStorage.getItem(this.FONT_SIZE_KEY) as FontSize;
      if (saved && ['small', 'standard', 'large'].includes(saved)) {
        return saved;
      }
    }
    return 'standard'; // Default
  }

  public setFontSize(size: FontSize): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(this.FONT_SIZE_KEY, size);
    }
    this.fontSizeSubject.next(size);
    this.applyFontSize(size);
  }

  public getCurrentFontSize(): FontSize {
    return this.fontSizeSubject.value;
  }

  private applyFontSize(size: FontSize): void {
    if (typeof document !== 'undefined') {
      // Remove existing font size classes
      document.documentElement.classList.remove('font-small', 'font-standard', 'font-large');
      
      // Add the new font size class
      document.documentElement.classList.add(`font-${size}`);
    }
  }

  public getFontSizeConfig(size: FontSize): FontSizeConfig | undefined {
    return this.fontSizeOptions.find(option => option.value === size);
  }
}

