import { ApiError } from './api-error';
import { jsonBody, requestJson } from './request-json';

function respond(status: number, body?: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
    }),
  );
}

describe('requestJson', () => {
  it('sends JSON with the signal and parses the body', async () => {
    const fetchFn = respond(200, { id: 'a' });
    const signal = new AbortController().signal;

    const result = await requestJson(fetchFn, '/api/x', {
      method: 'POST',
      signal,
      ...jsonBody({ value: '1.5' }),
    });

    expect(result).toEqual({ id: 'a' });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('/api/x');
    expect(init.signal).toBe(signal);
    expect(init.body).toBe('{"value":"1.5"}');
    expect(new Headers(init.headers).get('Content-Type')).toBe(
      'application/json',
    );
  });

  it('resolves no-content responses with undefined', async () => {
    await expect(requestJson(respond(204), '/api/x')).resolves.toBeUndefined();
  });

  it('turns error bodies into ApiError with code, message and details', async () => {
    const error = await requestJson(
      respond(422, {
        statusCode: 422,
        code: 'INVESTMENT_DATE_NOT_BUSINESS_DAY',
        message: '03/01/2026 não é dia útil.',
        details: { field: 'investmentDate', date: '2026-01-03' },
      }),
      '/api/x',
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 422,
      code: 'INVESTMENT_DATE_NOT_BUSINESS_DAY',
      userMessage: '03/01/2026 não é dia útil.',
      details: { field: 'investmentDate', date: '2026-01-03' },
    });
  });

  it('keeps unreadable error bodies as codeless errors', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response('<html>', { status: 502 }));
    await expect(requestJson(fetchFn, '/api/x')).rejects.toMatchObject({
      status: 502,
      code: null,
      userMessage: null,
      details: {},
    });
  });
});
