import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { includeBearerTokenInterceptor } from 'keycloak-angular';
import { appRoutes } from './app.routes';
import { provideWebAuthentication } from './auth/auth.config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideWebAuthentication(),
    provideHttpClient(withInterceptors([includeBearerTokenInterceptor])),
    provideRouter(appRoutes),
  ],
};
