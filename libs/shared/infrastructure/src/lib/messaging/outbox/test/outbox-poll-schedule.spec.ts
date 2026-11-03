import { Clock } from '@investflow/shared-application';
import { CalendarDate, UtcInstant } from '@investflow/shared-domain';
import type { OutboxConfig } from '../outbox.config';
import { OutboxPollSchedule } from '../outbox-poll-schedule';

const startedAt = UtcInstant.ofIso('2026-01-02T03:04:05Z');
const config: OutboxConfig = {
  pollMinIntervalMs: 1_000,
  pollMaxIntervalMs: 8_000,
  retentionIntervalMs: 6 * 60 * 60_000,
  retentionMs: 7 * 24 * 60 * 60_000,
};

const elapsed = () => Date.now() - startedAt.epochMilliseconds;
const inMs = (ms: number) => UtcInstant.ofEpochMilliseconds(Date.now() + ms);

interface DriveOptions {
  // Rows each poll claims, in order, then none.
  readonly claims?: number[];
  readonly isPaused?: () => boolean;
  // Runs inside each poll, as the publisher does when it records failures.
  readonly duringPoll?: (poll: number) => void;
}

// Polls the way OutboxPollerService does, and returns when each poll ran.
function drive(schedule: OutboxPollSchedule, options: DriveOptions = {}) {
  const claims = [...(options.claims ?? [])];
  const polls: number[] = [];
  const shutdown = new AbortController();
  const loop = (async () => {
    while (!shutdown.signal.aborted) {
      if (options.isPaused?.()) {
        await schedule.waitAfterPausedPoll(shutdown.signal);
        continue;
      }
      const pollStartedAt = UtcInstant.ofEpochMilliseconds(Date.now());
      polls.push(elapsed());
      options.duringPoll?.(polls.length - 1);
      const claimedRows = claims.shift() ?? 0;
      await schedule.waitAfterPoll(
        {
          startedAt: pollStartedAt,
          claimedRows,
          isBatchFull: claimedRows === 100,
        },
        shutdown.signal,
      );
    }
  })();
  return {
    polls,
    stop: async () => {
      shutdown.abort();
      await loop;
    },
  };
}

function createSchedule(): OutboxPollSchedule {
  const clock: Clock = {
    now: () => UtcInstant.ofEpochMilliseconds(Date.now()),
    today: () => CalendarDate.of('2026-01-02'),
  };
  return new OutboxPollSchedule(clock, config);
}

describe('OutboxPollSchedule', () => {
  beforeEach(() => jest.useFakeTimers({ now: startedAt.epochMilliseconds }));
  afterEach(() => jest.useRealTimers());

  it('doubles the wait after each empty poll, from the minimum up to the maximum', async () => {
    const poller = drive(createSchedule());

    await jest.advanceTimersByTimeAsync(39_000);

    expect(poller.polls).toEqual([
      0, 1_000, 3_000, 7_000, 15_000, 23_000, 31_000, 39_000,
    ]);
    await poller.stop();
  });

  it('returns to the minimum wait after a poll that claims rows', async () => {
    const poller = drive(createSchedule(), { claims: [0, 0, 0, 3] });

    await jest.advanceTimersByTimeAsync(11_000);

    expect(poller.polls).toEqual([
      0, 1_000, 3_000, 7_000, 8_000, 9_000, 11_000,
    ]);
    await poller.stop();
  });

  it('polls again at once after a full batch', async () => {
    const poller = drive(createSchedule(), { claims: [100, 100] });

    await jest.advanceTimersByTimeAsync(1_000);

    expect(poller.polls).toEqual([0, 0, 0, 1_000]);
    await poller.stop();
  });

  it('checks again after the minimum while paused, keeping the wait it had', async () => {
    const poller = drive(createSchedule(), {
      isPaused: () => elapsed() >= 2_500 && elapsed() < 3_500,
    });

    await jest.advanceTimersByTimeAsync(8_000);

    expect(poller.polls).toEqual([0, 1_000, 4_000, 8_000]);
    await poller.stop();
  });

  it('brings the next poll forward to a wake-up, never within the minimum of the last poll', async () => {
    const schedule = createSchedule();
    const poller = drive(schedule);

    await jest.advanceTimersByTimeAsync(7_200);
    schedule.wakePollerAt(inMs(0));
    await jest.advanceTimersByTimeAsync(1_800);
    expect(poller.polls).toEqual([0, 1_000, 3_000, 7_000, 8_000]);

    schedule.wakePollerAt(inMs(3_000));
    await jest.advanceTimersByTimeAsync(3_000);
    expect(poller.polls).toEqual([0, 1_000, 3_000, 7_000, 8_000, 12_000]);
    await poller.stop();
  });

  it('keeps a wake-up later than the pending one for a later poll', async () => {
    const schedule = createSchedule();
    const poller = drive(schedule);

    await jest.advanceTimersByTimeAsync(7_500);
    schedule.wakePollerAt(inMs(3_500));
    schedule.wakePollerAt(inMs(1_500));
    await jest.advanceTimersByTimeAsync(4_000);

    expect(poller.polls).toEqual([0, 1_000, 3_000, 7_000, 9_000, 11_000]);
    await poller.stop();
  });

  it('serves wake-ups within one minimum interval with the latest of them', async () => {
    const schedule = createSchedule();
    const poller = drive(schedule);

    await jest.advanceTimersByTimeAsync(7_500);
    schedule.wakePollerAt(inMs(1_700));
    schedule.wakePollerAt(inMs(2_100));
    await jest.advanceTimersByTimeAsync(2_100);

    expect(poller.polls).toEqual([0, 1_000, 3_000, 7_000, 9_600]);
    await poller.stop();
  });

  it('keeps a wake-up that arrives during a poll for the next one', async () => {
    const schedule = createSchedule();
    const poller = drive(schedule, {
      claims: [1],
      duringPoll: (poll) => {
        if (poll === 0) schedule.wakePollerAt(inMs(3_000));
      },
    });

    await jest.advanceTimersByTimeAsync(4_000);

    expect(poller.polls).toEqual([0, 1_000, 2_000, 3_000]);
    await poller.stop();
  });

  it('stops waiting on shutdown', async () => {
    const poller = drive(createSchedule());

    await jest.advanceTimersByTimeAsync(500);
    await poller.stop();
    await jest.advanceTimersByTimeAsync(10_000);

    expect(poller.polls).toEqual([0]);
  });
});
