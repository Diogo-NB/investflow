jest.mock('@investflow/shared-infrastructure', () => ({
  SkipTransaction: () => () => undefined,
}));

import { InvestmentSimulatorController } from './investment-simulator.controller';

describe('InvestmentSimulatorController', () => {
  it('requires the global bearer-token guard', () => {
    expect(
      Reflect.getMetadata(
        'IS_PUBLIC',
        InvestmentSimulatorController.prototype.hello,
      ),
    ).toBeUndefined();
  });

  it('returns the temporary hello-world response', () => {
    const controller = new InvestmentSimulatorController();

    expect(controller.hello()).toEqual({ message: 'Hello World' });
  });
});
