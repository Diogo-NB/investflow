import { investmentSimulatorRoutes } from './investment-simulator.routes';
it('resolves creation before identifier routes and protects both editors', async () => {
  expect(investmentSimulatorRoutes.map((r) => r.path)).toEqual([
    '',
    'nova',
    ':offerId/editar',
    ':offerId',
  ]);
  for (const route of investmentSimulatorRoutes.filter(
    (r) => r.canDeactivate,
  )) {
    const guard = route.canDeactivate![0] as (component: {
      canLeave(): Promise<boolean>;
    }) => Promise<boolean>;
    const page = { canLeave: vi.fn().mockResolvedValue(false) };
    expect(await guard(page)).toBe(false);
    expect(page.canLeave).toHaveBeenCalledOnce();
  }
});
