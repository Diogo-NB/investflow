import { appRoutes } from './app.routes';
import { Welcome } from './welcome/welcome';

describe('appRoutes', () => {
  it('opens the welcome page at the root and redirects unmatched paths to it', () => {
    expect(appRoutes.find(({ path }) => path === '')).toMatchObject({
      pathMatch: 'full',
      component: Welcome,
    });
    expect(appRoutes.at(-1)).toEqual({ path: '**', redirectTo: '' });
  });
});
