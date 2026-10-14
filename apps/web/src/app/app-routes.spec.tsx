import { isValidElement } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { createAppRoutes } from './app-routes';
import { Welcome } from './welcome/welcome';

function pageRoutes(): RouteObject[] {
  const routes = createAppRoutes({ fetch: vi.fn() });
  return routes[0]?.children?.[0]?.children ?? [];
}

describe('createAppRoutes', () => {
  it('opens the welcome page at the root', () => {
    expect(pageRoutes().find((route) => route.index)?.Component).toBe(Welcome);
  });

  it('mounts the investment simulator under /simulacoes and /ofertas', () => {
    const paths = pageRoutes().map((route) => route.path);
    expect(paths).toContain('simulacoes');
    expect(paths).toContain('ofertas');
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
