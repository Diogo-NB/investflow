jest.mock('@investflow/shared-infrastructure', () => ({
  Public: () => () => undefined,
  SkipTransaction: () => () => undefined,
}));

import { InvestmentSimulatorController } from './investment-simulator.controller';

describe('InvestmentSimulatorController', () => {
  it('returns the temporary hello-world response', () => {
    const controller = new InvestmentSimulatorController();

    expect(controller.hello()).toEqual({ message: 'Hello World' });
  });
});
