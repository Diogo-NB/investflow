import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { AuthSession } from './auth/auth-session.service';

describe('App', () => {
  it('exposes auth signals and delegates logout intent without rendering', () => {
    const auth = {
      identity: signal('investflow-dev').asReadonly(),
      logoutState: signal('idle').asReadonly(),
      logout: vi.fn().mockResolvedValue(undefined),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: AuthSession, useValue: auth }],
    });
    const component = TestBed.runInInjectionContext(() => new App());

    expect(component.auth).toBe(auth);
    component.logout();
    expect(auth.logout).toHaveBeenCalledOnce();
  });
});
