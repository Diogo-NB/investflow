import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { AuthSession } from './auth/auth-session.service';

describe('App', () => {
  const auth = {
    identity: 'investflow-dev',
    logoutState: vi.fn(() => 'idle'),
    logout: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    auth.logoutState.mockReturnValue('idle');
    auth.logout.mockClear();
    TestBed.configureTestingModule({
      providers: [{ provide: AuthSession, useValue: auth }],
    });
  });

  it('exposes authentication state to the shell', () => {
    const component = TestBed.runInInjectionContext(() => new App());

    expect(component.auth.identity).toBe('investflow-dev');
    expect(component.auth.logoutState()).toBe('idle');
  });

  it('delegates logout intent to the authentication store', () => {
    const component = TestBed.runInInjectionContext(() => new App());

    component.logout();

    expect(auth.logout).toHaveBeenCalledOnce();
  });
});
