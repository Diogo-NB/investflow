import {
  AUTH_INACTIVITY_TIMEOUT_MS,
  type SessionClient,
  startAuthentication,
} from './session';

const location = {
  origin: 'https://app.example.com',
  pathname: '/ofertas/offer-id',
  search: '?titleType=CDB&page=2',
};

function fakeKeycloak(initResult: () => Promise<boolean>) {
  const keycloak = {
    init: vi.fn<SessionClient['init']>(initResult),
    updateToken: vi.fn<SessionClient['updateToken']>().mockResolvedValue(true),
    logout: vi.fn<SessionClient['logout']>().mockResolvedValue(undefined),
  };
  return keycloak satisfies SessionClient as typeof keycloak & SessionClient;
}

describe('startAuthentication', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('requires login with PKCE and returns to the requested path and query', async () => {
    const keycloak = fakeKeycloak(() => Promise.resolve(true));

    await startAuthentication(keycloak, location, new EventTarget());

    expect(keycloak.init).toHaveBeenCalledWith({
      onLoad: 'login-required',
      flow: 'standard',
      pkceMethod: 'S256',
      redirectUri:
        'https://app.example.com/ofertas/offer-id?titleType=CDB&page=2',
    });
  });

  it.each([
    ['an unauthenticated result', () => Promise.resolve(false)],
    ['a failed initialization', () => Promise.reject(new Error('offline'))],
  ])('rejects %s without starting the session policy', async (_, result) => {
    const keycloak = fakeKeycloak(result);

    await expect(
      startAuthentication(keycloak, location, new EventTarget()),
    ).rejects.toThrow();
    expect(keycloak.onTokenExpired).toBeUndefined();
  });

  describe('when the access token expires', () => {
    async function start() {
      const keycloak = fakeKeycloak(() => Promise.resolve(true));
      const activity = new EventTarget();
      await startAuthentication(keycloak, location, activity);
      return { keycloak, activity };
    }

    it('refreshes the token for a recently active user', async () => {
      const { keycloak } = await start();
      vi.advanceTimersByTime(AUTH_INACTIVITY_TIMEOUT_MS - 1);

      keycloak.onTokenExpired?.();

      expect(keycloak.updateToken).toHaveBeenCalledOnce();
      expect(keycloak.logout).not.toHaveBeenCalled();
    });

    it('signs out a user inactive for the timeout, back to the app origin', async () => {
      const { keycloak } = await start();
      vi.advanceTimersByTime(AUTH_INACTIVITY_TIMEOUT_MS);

      keycloak.onTokenExpired?.();

      expect(keycloak.updateToken).not.toHaveBeenCalled();
      expect(keycloak.logout).toHaveBeenCalledWith({
        redirectUri: 'https://app.example.com',
      });
    });

    it('counts user activity as staying active', async () => {
      const { keycloak, activity } = await start();
      vi.advanceTimersByTime(AUTH_INACTIVITY_TIMEOUT_MS - 1);
      activity.dispatchEvent(new Event('keydown'));
      vi.advanceTimersByTime(AUTH_INACTIVITY_TIMEOUT_MS - 1);

      keycloak.onTokenExpired?.();

      expect(keycloak.updateToken).toHaveBeenCalledOnce();
    });

    it('signs out when the refresh fails', async () => {
      const { keycloak } = await start();
      keycloak.updateToken.mockRejectedValueOnce(new Error('session ended'));

      keycloak.onTokenExpired?.();
      await vi.waitFor(() =>
        expect(keycloak.logout).toHaveBeenCalledWith({
          redirectUri: 'https://app.example.com',
        }),
      );
    });
  });

  it('notifies subscribers when Keycloak changes the session', async () => {
    const keycloak = fakeKeycloak(() => Promise.resolve(true));
    const session = await startAuthentication(
      keycloak,
      location,
      new EventTarget(),
    );
    const onChange = vi.fn();
    const unsubscribe = session.subscribe(onChange);

    keycloak.onAuthRefreshSuccess?.();
    unsubscribe();
    keycloak.onAuthLogout?.();

    expect(onChange).toHaveBeenCalledOnce();
  });

  it('logs out back to the app origin', async () => {
    const keycloak = fakeKeycloak(() => Promise.resolve(true));
    const session = await startAuthentication(
      keycloak,
      location,
      new EventTarget(),
    );

    await session.logout();

    expect(keycloak.logout).toHaveBeenCalledWith({
      redirectUri: 'https://app.example.com',
    });
  });
});
