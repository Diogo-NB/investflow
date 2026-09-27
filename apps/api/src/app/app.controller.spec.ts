jest.mock('@investflow/shared-infrastructure', () => ({
  Public:
    () =>
    (
      _target: object,
      _propertyKey: string | symbol,
      descriptor: PropertyDescriptor,
    ) =>
      Reflect.defineMetadata('IS_PUBLIC', true, descriptor.value),
  SkipTransaction: () => () => undefined,
}));

import { AppController } from './app.controller';

describe('AppController authentication metadata', () => {
  it('keeps the health check public', () => {
    expect(
      Reflect.getMetadata('IS_PUBLIC', AppController.prototype.check),
    ).toBe(true);
  });
});
