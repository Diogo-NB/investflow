import { AppError, EAppErrorCode, Result } from '@investflow/shared-domain';
import { SimulationRecalculationConsumer } from './simulation-recalculation.consumer';

jest.mock('@investflow/shared-infrastructure', () => ({
  OnEvent: () => () => undefined,
}));

const FAILURE = new AppError('Falhou.', {
  code: EAppErrorCode.REPOSITORY_FIND_FAILED,
  kind: 'infrastructure',
});

function setup(result: Result<void, AppError> = Result.ok(undefined)) {
  const offer = { execute: jest.fn().mockResolvedValue(result) };
  const curve = { execute: jest.fn().mockResolvedValue(result) };
  const consumer = new SimulationRecalculationConsumer(
    offer as never,
    curve as never,
  );
  return { offer, curve, consumer };
}

describe('SimulationRecalculationConsumer', () => {
  it.each(['onOfferTermsChanged', 'onOfferDeleted'] as const)(
    'recalculates the simulations of the offer on %s',
    async (handler) => {
      const { offer, curve, consumer } = setup();

      await consumer[handler]({ aggregateId: 'offer-id' });

      expect(offer.execute).toHaveBeenCalledWith({ offerId: 'offer-id' });
      expect(curve.execute).not.toHaveBeenCalled();
    },
  );

  it.each(['onCurveValuesChanged', 'onCurveDeleted'] as const)(
    'recalculates the simulations of the curve on %s',
    async (handler) => {
      const { offer, curve, consumer } = setup();

      await consumer[handler]({ aggregateId: 'curve-id' });

      expect(curve.execute).toHaveBeenCalledWith({ curveId: 'curve-id' });
      expect(offer.execute).not.toHaveBeenCalled();
    },
  );

  it('throws a failure so the queue retries the message', async () => {
    const { consumer } = setup(Result.err(FAILURE));

    await expect(
      consumer.onCurveValuesChanged({ aggregateId: 'curve-id' }),
    ).rejects.toBe(FAILURE);
  });

  it('throws on a payload without the premise', async () => {
    const { offer, consumer } = setup();

    await expect(
      consumer.onOfferDeleted({ eventType: 'OfferDeleted' }),
    ).rejects.toThrow();
    expect(offer.execute).not.toHaveBeenCalled();
  });
});
