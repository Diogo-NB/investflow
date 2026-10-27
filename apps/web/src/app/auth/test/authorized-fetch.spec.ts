import { createAuthorizedFetch, isApiRequest } from '../authorized-fetch';

function setup() {
  const keycloak = {
    token: 'access-token',
    updateToken: vi.fn().mockResolvedValue(true),
  };
  const send = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  return { keycloak, send, fetch: createAuthorizedFetch(keycloak, send) };
}

describe('authorized fetch', () => {
  it.each(['/api', '/api/investment-simulator/simulations', '/api?x=1'])(
    'refreshes and attaches the bearer to %s',
    async (url) => {
      const { keycloak, send, fetch } = setup();

      await fetch(url, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });

      expect(keycloak.updateToken).toHaveBeenCalledWith(30);
      const init = send.mock.calls[0][1] as RequestInit;
      const headers = new Headers(init.headers);
      expect(headers.get('Authorization')).toBe('Bearer access-token');
      expect(headers.get('Accept')).toBe('application/json');
      expect(init.method).toBe('POST');
    },
  );

  it.each([
    'https://evil.example.com/api/x',
    '//evil.example.com/api',
    '/apiary',
    '/other/api',
    'api/x',
  ])('sends %s without a token', async (url) => {
    const { keycloak, send, fetch } = setup();

    await fetch(url);

    expect(isApiRequest(url)).toBe(false);
    expect(keycloak.updateToken).not.toHaveBeenCalled();
    expect(
      new Headers((send.mock.calls[0][1] as RequestInit).headers).has(
        'Authorization',
      ),
    ).toBe(false);
  });

  it('does not send the request when the token cannot be refreshed', async () => {
    const { keycloak, send, fetch } = setup();
    keycloak.updateToken.mockRejectedValue(new Error('expired'));

    await expect(fetch('/api/x')).rejects.toThrow('expired');
    expect(send).not.toHaveBeenCalled();
  });
});
