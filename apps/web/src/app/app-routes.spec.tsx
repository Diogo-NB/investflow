import { isValidElement } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { appRoutes } from './app-routes';
import { Welcome } from './welcome/welcome';

function pageRoutes(): RouteObject[] {
  return appRoutes[0]?.children?.[0]?.children ?? [];
}

describe('appRoutes', () => {
  it('opens the welcome page at the root', () => {
    expect(pageRoutes().find((route) => route.index)?.Component).toBe(Welcome);
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
