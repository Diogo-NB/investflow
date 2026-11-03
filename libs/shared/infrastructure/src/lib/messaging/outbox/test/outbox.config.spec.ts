import { outboxEnvironment } from '../outbox.config';

describe('outboxEnvironment', () => {
  it('rejects a maximum poll interval below the minimum', () => {
    const parsed = outboxEnvironment.safeParse({
      OUTBOX_POLL_MIN_INTERVAL_SECONDS: '10',
      OUTBOX_POLL_MAX_INTERVAL_SECONDS: '5',
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues).toEqual([
      expect.objectContaining({
        path: ['OUTBOX_POLL_MAX_INTERVAL_SECONDS'],
        message: 'must be at least OUTBOX_POLL_MIN_INTERVAL_SECONDS',
      }),
    ]);
  });

  it('accepts equal minimum and maximum poll intervals', () => {
    const parsed = outboxEnvironment.safeParse({
      OUTBOX_POLL_MIN_INTERVAL_SECONDS: '5',
      OUTBOX_POLL_MAX_INTERVAL_SECONDS: '5',
    });

    expect(parsed.success).toBe(true);
  });

  it('checks the default maximum against a minimum set alone', () => {
    const parsed = outboxEnvironment.safeParse({
      OUTBOX_POLL_MIN_INTERVAL_SECONDS: '120',
    });

    expect(parsed.success).toBe(false);
  });
});
