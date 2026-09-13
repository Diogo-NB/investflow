import { Routes } from '@angular/router';
import { appRoutes } from './app.routes';

describe('appRoutes', () => {
  it('redirects the root route to the investment simulator', () => {
    expect(appRoutes[0]).toEqual({
      path: '',
      pathMatch: 'full',
      redirectTo: 'investment-simulator',
    });
  });

  it('loads the investment simulator routes lazily', async () => {
    const featureRoute = appRoutes.find(
      ({ path }) => path === 'investment-simulator',
    );
    const loadChildren = featureRoute?.loadChildren;

    expect(loadChildren).toBeTypeOf('function');

    const loadedRoutes = await (loadChildren as () => Promise<Routes>)();
    expect(loadedRoutes).toHaveLength(1);
    expect(loadedRoutes[0]).toMatchObject({
      path: '',
      title: 'Simulador de investimentos | InvestFlow',
    });
    expect(loadedRoutes[0]?.component).toBeDefined();
  });
});
