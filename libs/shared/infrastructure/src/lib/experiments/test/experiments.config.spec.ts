import { experimentsEnvironment } from '../experiments.config';

const target = {
  EXPERIMENT_TARGET_AGGREGATE_ID: 'simulation-1',
  EXPERIMENT_TARGET_EVENT_TYPE: 'SimulationEdited',
};

describe('experimentsEnvironment', () => {
  it('accepts no switch against the production bus', () => {
    const parsed = experimentsEnvironment.safeParse({
      EVENT_BUS_NAME: 'investflow',
    });

    expect(parsed.success).toBe(true);
  });

  it('refuses a switch against a bus that is not the experiments one', () => {
    const parsed = experimentsEnvironment.safeParse({
      EXPERIMENT_SKIP_REVISION_GUARD: 'true',
      EVENT_BUS_NAME: 'investflow',
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues).toEqual([
      expect.objectContaining({ path: ['EVENT_BUS_NAME'] }),
    ]);
  });

  it('accepts a switch against the homolog bus', () => {
    const parsed = experimentsEnvironment.safeParse({
      EXPERIMENT_MESSAGE_FAULT: 'dead-letter',
      ...target,
      EVENT_BUS_NAME: 'investflow-homolog',
    });

    expect(parsed.success).toBe(true);
  });

  it('accepts a switch against the local emulator', () => {
    const parsed = experimentsEnvironment.safeParse({
      EXPERIMENT_LOGIC_ERROR: 'true',
      EVENT_BUS_NAME: 'investflow',
      AWS_ENDPOINT_URL: 'http://localhost:4566',
    });

    expect(parsed.success).toBe(true);
  });

  it('requires a target for a message fault', () => {
    const parsed = experimentsEnvironment.safeParse({
      EXPERIMENT_MESSAGE_FAULT: 'duplicate',
      EVENT_BUS_NAME: 'investflow-homolog',
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues).toEqual([
      expect.objectContaining({ path: ['EXPERIMENT_TARGET_AGGREGATE_ID'] }),
    ]);
  });
});
