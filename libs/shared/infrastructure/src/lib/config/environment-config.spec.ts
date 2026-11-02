import { z } from 'zod';
import { environmentConfig } from './environment-config';

const testEnvironment = z.object({
  TEST_SERVICE_URL: z.url(),
  TEST_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(30),
});

const testConfig = environmentConfig(
  'test',
  testEnvironment,
  (environment) => ({
    serviceUrl: environment.TEST_SERVICE_URL,
    timeoutMs: environment.TEST_TIMEOUT_SECONDS * 1_000,
  }),
);

describe('environmentConfig', () => {
  const original = { ...process.env };

  afterEach(() => {
    for (const name of Object.keys(process.env)) {
      if (!(name in original)) delete process.env[name];
    }
    Object.assign(process.env, original);
  });

  it('maps the parsed variables to the config and applies defaults', () => {
    process.env['TEST_SERVICE_URL'] = 'https://service.example.com';

    expect(testConfig()).toEqual({
      serviceUrl: 'https://service.example.com',
      timeoutMs: 30_000,
    });
  });

  it('coerces numeric variables from their string values', () => {
    process.env['TEST_SERVICE_URL'] = 'https://service.example.com';
    process.env['TEST_TIMEOUT_SECONDS'] = '5';

    expect(testConfig()).toEqual(expect.objectContaining({ timeoutMs: 5_000 }));
  });

  it('treats an empty variable as unset, so its default applies', () => {
    process.env['TEST_SERVICE_URL'] = 'https://service.example.com';
    process.env['TEST_TIMEOUT_SECONDS'] = '';

    expect(testConfig()).toEqual(
      expect.objectContaining({ timeoutMs: 30_000 }),
    );
  });

  it('hands the mapping only the variables its schema declares', () => {
    process.env['TEST_SERVICE_URL'] = 'https://service.example.com';
    process.env['TEST_UNRELATED'] = 'ignored';
    const toConfig = jest.fn().mockReturnValue({});

    environmentConfig('test', testEnvironment, toConfig)();

    expect(toConfig).toHaveBeenCalledWith({
      TEST_SERVICE_URL: 'https://service.example.com',
      TEST_TIMEOUT_SECONDS: 30,
    });
  });

  it('lists every invalid variable by name without echoing its value', () => {
    process.env['TEST_SERVICE_URL'] = 'postgres-secret-password';
    process.env['TEST_TIMEOUT_SECONDS'] = '-1';

    let message = '';
    try {
      testConfig();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }

    expect(message).toMatch(/^Invalid test environment:/);
    expect(message).toContain('TEST_SERVICE_URL');
    expect(message).toContain('TEST_TIMEOUT_SECONDS');
    expect(message).not.toContain('postgres-secret-password');
  });

  it('reports a required variable that is not set', () => {
    expect(() => testConfig()).toThrow(/TEST_SERVICE_URL/);
  });
});
