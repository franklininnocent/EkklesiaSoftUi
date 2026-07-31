import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideStore } from '@ngrx/store';
import { provideEffects } from '@ngrx/effects';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { routes } from './app.routes';
import { authInterceptor } from '@core/interceptors/auth.interceptor';
import { errorInterceptor } from '@core/interceptors/error.interceptor';
import { tenantInterceptor } from '@core/interceptors/tenant.interceptor';
import { environment } from '@environments/environment';
import { metaReducers, reducers } from '@core/store';
import { AuthEffects } from '@core/store/auth/auth.effects';
import { TenantEffects } from '@core/store/tenant/tenant.effects';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([
        authInterceptor,
        tenantInterceptor,
        errorInterceptor
      ])
    ),
    provideAnimations(),
    provideStore(reducers, { metaReducers }),
    provideEffects([AuthEffects, TenantEffects]),
    provideStoreDevtools({
      maxAge: 25,
      logOnly: environment.production
    })
  ]
};

