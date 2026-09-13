import { ApplicationRef } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

type AngularBootstrap = typeof bootstrapApplication;

export function bootstrapWebApplication(
  bootstrap: AngularBootstrap = bootstrapApplication,
): Promise<ApplicationRef> {
  return bootstrap(App, appConfig);
}
