import { Toast } from '@base-ui/react/toast';
import { isValidElement } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { createAppRoutes } from './app-routes';
import { Welcome } from './welcome/welcome';

function pageRoutes(): RouteObject[] {
  const routes = createAppRoutes({
    fetch: vi.fn(),
    toasts: Toast.createToastManager(),
  });
  return routes[0]?.children?.[0]?.children ?? [];
}

describe('createAppRoutes', () => {
  it('opens the welcome page at the root, with the simulator home inside', () => {
    const welcome = pageRoutes().find(
      (route) =>
        isValidElement(route.element) && route.element.type === Welcome,
    );

    expect(welcome?.path).toBeUndefined();
    expect(welcome?.children?.[0]?.children?.[0]?.index).toBe(true);
  });

  it('mounts the investment simulator under /simulacoes, /planos, /ofertas, and /curvas', () => {
    const paths = pageRoutes().map((route) => route.path);
    expect(paths).toContain('simulacoes');
    expect(paths).toContain('planos');
    expect(paths).toContain('ofertas');
    expect(paths).toContain('curvas');
  });

  it('redirects unknown paths to the root', () => {
    const fallback = pageRoutes().find((route) => route.path === '*')?.element;

    expect(isValidElement(fallback) && fallback.type).toBe(Navigate);
    expect(isValidElement(fallback) && fallback.props).toEqual({
      to: '/',
      replace: true,
    });
  });
});
