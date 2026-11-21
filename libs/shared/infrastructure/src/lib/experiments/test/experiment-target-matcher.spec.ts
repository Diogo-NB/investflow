import { ExperimentTargetMatcher } from '../experiment-target-matcher';

const target = {
  aggregateId: 'simulation-1',
  eventType: 'SimulationEdited',
  ordinal: 2,
};

function edited(eventId: string, aggregateId = 'simulation-1') {
  return { eventId, eventType: 'SimulationEdited', aggregateId };
}

describe('ExperimentTargetMatcher', () => {
  it('matches the event at the ordinal among its aggregate and type', () => {
    const matcher = new ExperimentTargetMatcher(target);

    expect(matcher.matches(edited('event-1'))).toBe(false);
    expect(matcher.matches(edited('event-other', 'simulation-2'))).toBe(false);
    expect(matcher.matches({ ...edited('event-x'), eventType: 'Other' })).toBe(
      false,
    );
    expect(matcher.matches(edited('event-2'))).toBe(true);
  });

  it('does not count a redelivered event twice', () => {
    const matcher = new ExperimentTargetMatcher(target);

    matcher.matches(edited('event-1'));

    expect(matcher.matches(edited('event-1'))).toBe(false);
    expect(matcher.matches(edited('event-2'))).toBe(true);
  });

  it('keeps matching only the pinned event', () => {
    const matcher = new ExperimentTargetMatcher(target);
    matcher.matches(edited('event-1'));
    matcher.matches(edited('event-2'));

    expect(matcher.matches(edited('event-2'))).toBe(true);
    expect(matcher.matches(edited('event-3'))).toBe(false);
  });

  it('matches nothing without a target', () => {
    const matcher = new ExperimentTargetMatcher(undefined);

    expect(matcher.matches(edited('event-1'))).toBe(false);
  });
});
