import { PublishedIndexValuesImportedContract } from '@investflow/market-data-contracts';
import {
  EPublishedIndex,
  PublishedIndexValue,
  PublishedIndexValuesImported,
} from '@investflow/market-data-domain';
import { CalendarDate, UtcInstant } from '@investflow/shared-domain';
import Decimal from 'decimal.js';

// The domain may not import the contract, so this assignment is what ties the
// event's serialized shape to it; a mismatch fails the typecheck target.
describe('PublishedIndexValuesImported', () => {
  it('serializes to its contract', () => {
    const event = new PublishedIndexValuesImported(
      'series-1',
      EPublishedIndex.CDI,
      [
        PublishedIndexValue.of(
          CalendarDate.of('2026-11-03'),
          new Decimal('0.1365'),
        ),
      ],
      UtcInstant.ofIso('2026-11-04T13:00:00.000Z'),
    );

    const serialized: PublishedIndexValuesImportedContract = {
      ...event,
      occurredAt: event.occurredAt.toISOString(),
    };

    expect(serialized).toMatchObject({
      eventType: 'PublishedIndexValuesImported',
      context: 'market-data',
      aggregateType: 'PublishedIndexSeries',
      aggregateId: 'series-1',
      index: 'CDI',
      values: [{ referenceDate: '2026-11-03', value: '0.1365' }],
    });
  });
});
