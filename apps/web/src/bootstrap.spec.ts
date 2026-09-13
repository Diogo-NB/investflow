import { ApplicationRef } from '@angular/core';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { bootstrapWebApplication } from './bootstrap';

describe('bootstrapWebApplication', () => {
  it('bootstraps the root component with the application configuration', async () => {
    const applicationRef = {} as ApplicationRef;
    const bootstrap = vi.fn().mockResolvedValue(applicationRef);

    await expect(bootstrapWebApplication(bootstrap)).resolves.toBe(
      applicationRef,
    );
    expect(bootstrap).toHaveBeenCalledWith(App, appConfig);
  });
});
