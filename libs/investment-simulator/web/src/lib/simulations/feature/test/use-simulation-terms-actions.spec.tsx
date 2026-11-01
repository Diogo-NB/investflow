import { act, renderHook, waitFor } from '@testing-library/react';
import {
  apiFailure,
  fakeApi,
  harness,
} from '../../../testing/simulator-harness';
import {
  cdiOffer,
  options,
  ownTermsWorkspace,
  selicOffer,
  workspace,
} from '../../../testing/simulator-fixtures';
import type { SimulationWorkspace } from '../../models/simulation.types';
import { useSimulationTermsActions } from '../use-simulation-terms-actions';

const API = '/api/investment-simulator';

function render(
  api: ReturnType<typeof fakeApi>,
  saved: SimulationWorkspace = ownTermsWorkspace,
) {
  const wrapper = harness(api);
  const onDone = vi.fn(async () => undefined);
  const rendered = renderHook(
    () =>
      useSimulationTermsActions({
        workspace: saved,
        options,
        revision: 3,
        onDone,
      }),
    wrapper,
  );
  return { ...rendered, onDone, added: vi.spyOn(wrapper.toasts, 'add') };
}

describe('useSimulationTermsActions', () => {
  it('offers the base while it can be chosen, and applying only to an own base', () => {
    const own = render(fakeApi({}));
    expect(own.result.current.base).toBe(cdiOffer);
    expect(own.result.current.canApply).toBe(true);

    const systemBase = render(fakeApi({}), {
      ...ownTermsWorkspace,
      offer: {
        ...ownTermsWorkspace.offer,
        basedOn: { ...workspace.offer, id: selicOffer.id, deleted: false },
      },
    });
    expect(systemBase.result.current.base).toBe(selicOffer);
    expect(systemBase.result.current.canApply).toBe(false);

    const deletedBase = render(fakeApi({}), {
      ...ownTermsWorkspace,
      offer: {
        ...ownTermsWorkspace.offer,
        basedOn: { ...workspace.offer, deleted: true },
      },
    });
    expect(deletedBase.result.current.base).toBeUndefined();

    const following = render(fakeApi({}), workspace);
    expect(following.result.current.isOwnTerms).toBe(false);
    expect(following.result.current.base).toBeUndefined();
  });

  it('returns to the offer with a curve its index accepts', async () => {
    const api = fakeApi({
      [`PATCH ${API}/simulations/sim`]: { revision: 4 },
    });
    const { result, onDone } = render(api);

    act(() => result.current.returnToOffer.run(cdiOffer));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.bodies(`PATCH ${API}/simulations/sim`)).toEqual([
      {
        offerId: 'cdi-offer',
        investment: {
          principal: '10000',
          investmentDate: '2026-01-02',
          curveId: 'cdi',
        },
        revision: 3,
      },
    ]);
  });

  it('applies the own terms to the offer, then follows it', async () => {
    const api = fakeApi({
      [`PATCH ${API}/offers/cdi-offer`]: undefined,
      [`PATCH ${API}/simulations/sim`]: { revision: 4 },
    });
    const { result, onDone } = render(api);

    act(() => result.current.applyToOffer.run(cdiOffer));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.bodies(`PATCH ${API}/offers/cdi-offer`)).toEqual([
      {
        revision: 2,
        remunerationTerms: { kind: 'CDI_PERCENTAGE', rate: '1.1' },
      },
    ]);
    expect(api.calls()).toEqual([
      `PATCH ${API}/offers/cdi-offer`,
      `PATCH ${API}/simulations/sim`,
    ]);
  });

  it('follows nothing when applying to the offer fails', async () => {
    const api = fakeApi({
      [`PATCH ${API}/offers/cdi-offer`]: apiFailure(
        409,
        'OFFER_REVISION_CONFLICT',
      ),
    });
    const { result, onDone } = render(api);

    act(() => result.current.applyToOffer.run(cdiOffer));

    await waitFor(() =>
      expect(result.current.applyToOffer.failed).toBe(
        'Mensagem de OFFER_REVISION_CONFLICT.',
      ),
    );
    expect(api.calls()).toEqual([`PATCH ${API}/offers/cdi-offer`]);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('saves the own terms as an offer in Ofertas and says where', async () => {
    const api = fakeApi({
      [`POST ${API}/offers/own-terms/move-to-catalog`]: undefined,
    });
    const { result, onDone, added } = render(api);

    act(() => result.current.moveToCatalog.run(undefined));

    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(api.bodies(`POST ${API}/offers/own-terms/move-to-catalog`)).toEqual([
      { revision: 1 },
    ]);
    expect(added).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Oferta CDB 110% do CDI salva em Minhas',
        data: { link: { to: '/ofertas/own-terms', label: 'Ver oferta' } },
      }),
    );
  });

  it('ignores a second action while one is pending', async () => {
    let release = () => undefined as void;
    const api = fakeApi({
      [`PATCH ${API}/simulations/sim`]: () =>
        new Promise((resolve) => {
          release = () => resolve({ revision: 4 });
        }),
    });
    const { result, onDone } = render(api);

    act(() => result.current.returnToOffer.run(cdiOffer));
    act(() => result.current.returnToOffer.run(cdiOffer));
    await waitFor(() => expect(api.calls()).toHaveLength(1));
    release();

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(api.calls()).toHaveLength(1);
  });
});
