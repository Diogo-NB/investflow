# Simulation Offer Editing

> **Status: planned, not started.** The flow was settled on 2026-10-31; the
> user-visible behavior is in "Simulação" in
> [Telas de Simulações](../../product/screens/simulations.md) and the visual
> rules in "Simulation workspace" in [`DESIGN.md`](../../../DESIGN.md). This
> file owns the implementation and is deleted once it ships.

## Goal and scope

The simulation workspace (`/simulacoes/nova` and `/simulacoes/:id`) edits
the user's own chosen offer in place, and its three ways of changing the
offer say what each one does to the saved offers.

- **Ships:** "Editar oferta" in the "Oferta" section; "Digitar termos"
  renamed "Nova oferta"; a header and a consequence line per mode; action
  icons on the section's buttons; the "criada em Minhas" toast on every
  offer the form creates; the count of the other simulations an edit
  recalculates.
- **Out of scope:** editing a system offer (only duplicated, as today);
  editing a curve from the workspace; a confirmation dialog before saving
  an offer edit.

## Decisions (2026-10-31)

1. **Inline, saved with "Salvar e calcular"**, not a dialog: the results
   stay visible beside the form, the edit mode works like "Duplicar e
   ajustar", and a curve made invalid by an index change is fixed in the
   same save. Tradeoff: one save can send two requests, so it can
   half-succeed (offer saved, simulation rejected); see "Save flow".
2. **The warning counts the other simulations** ("Outras N…"), because
   this simulation recalculates anyway. The server excludes it through a
   list filter, so the browser does no arithmetic on the count.
3. **An index change also warns** that the other simulations will be in
   "Requer ação" until each one is saved with a curve of the new index (or
   with no curve on a prefixed offer): the calculation rejects an offer and
   curve of different indices, including a prefixed offer with a curve
   (`INVESTMENT_CURVE_INCOMPATIBLE`, `investment-scenario.vo.ts`).
4. **"Salvar como nova oferta"** turns an edit into a copy, keeping what
   was typed.
5. **Both routes**: a new simulation edits its chosen own offer the same
   way.
6. **"Digitar termos" becomes "Nova oferta"**, which names what it creates.
7. **The always-visible explanation paragraph goes**; each mode shows its
   own consequence line.
8. **Every offer the form creates is announced** with a toast and "Ver
   oferta", replacing today's toast that appears only when the simulation is
   rejected.

## Model

No domain, schema, or event change. The offer edit is today's
`PATCH /offers/:id` with the revision the edit started from, and it raises
the events the offer editor already raises (`OfferTermsChanged`,
`OfferDetailsChanged`), so the other simulations recalculate through the
existing flow (`docs/architecture/recalculation.md`). Each request still
changes one aggregate: the offer request, then the simulation request.

The one API change is a list filter: `GET /simulations?offerId=&excludingId=`
returns the user's simulations of an offer except one. It is a filter on the
existing list query, not a new endpoint, because the screen needs the same
resource with one row left out.

## Implementation

### Modes, names, icons, and toasts

`simulations/utils/simulation-form.ts`

```ts
export interface SimulationFormValues {
  // A chosen offer, the chosen own offer's terms being edited, or terms for a
  // new private offer. Edited and new offers are saved before the simulation.
  offerMode: 'existing' | 'editing' | 'new';
  offerId: string;
  // The offer "Duplicar e ajustar" copied; blank for "Nova oferta".
  copiedOfferId: string;
  // The edited or new offer's name; unused for a chosen offer.
  offerName: string;
  // ...unchanged fields
}
```

- `simulationFormSchema`: `offerId` is required in `existing` and `editing`.
- `simulationValues()` drops a saved curve when the offer's kind takes no
  index. Today a saved simulation whose offer became prefixed loads its old
  `curveId` into a hidden field, and saving sends it, so the API rejects the
  save on a field the user cannot see. Confirm it in the browser before
  fixing; it is the path the index-change warning sends users down.
- `toEditedOfferValues(values): OfferFormValues` maps the term fields and
  `offerName` to the offer editor's values, so `offerEdit()` and
  `changesOfferTerms()` from `offers/utils/offer-form.ts` are reused as they
  are.

`simulations/feature/use-simulation-form.ts`

- `typeTerms` becomes `newOffer`; `duplicateOffer` also sets
  `copiedOfferId`. `backToChosenOffer` stays.

`simulations/feature/use-typed-offer-saving.ts` becomes
`use-simulation-offer-saving.ts` (`useSimulationOfferSaving`), since it
saves edited offers too (see below). Creating an offer adds the toast on
every success:

```ts
toasts.add({
  title: `Oferta ${offerTermsLabel(input)} criada em Minhas`,
  data: { link: { to: `/ofertas/${offerId}`, label: 'Ver oferta' } },
});
```

`reportKept()` goes away: the toast is already shown when the simulation is
rejected afterwards.

`simulations/feature/simulation-form-panel.tsx`

- `ChosenOffer`: buttons `[CopyIcon] Duplicar e ajustar` and
  `[PlusIcon] Nova oferta`; the paragraph below them goes away.
- `TermsFieldset` legend: "Nova oferta", plus "· cópia de {terms}" when
  `copiedOfferId` names a listed offer. Consequence line with `InfoIcon`:
  "Será criada em Ofertas › Minhas ao salvar." plus " A oferta original não
  muda." for a copy. Back button `[ChevronLeftIcon] Voltar à oferta
  escolhida`, or "Usar uma oferta existente" when no offer was chosen.
- Save hint: "Salvar cria a oferta e calcula a simulação." in `new` mode.

### Editing the chosen offer

API (`libs/investment-simulator/infrastructure/src/lib/simulations`)

- `http/requests/list-simulations.request.ts`: `@IsOptional() @IsUUID()
  excludingId?: string`.
- `queries/list-simulations.query-handler.ts`: `excludingId?: string` on
  `ListSimulationsQuery`, and
  `query.excludingId ? { id: { not: query.excludingId } } : {}` in `where`.
  The count and the page use the same `where`.

Web

`offers/feature/use-offer-details.ts`: `useOfferSimulations(offerId,
{ excludingId, pageSize })`, so the workspace reads the count with
`pageSize: 1` and no rows it does not show. The offer pages keep calling it
without options.

`simulations/feature/use-simulation-form.ts`

```ts
// The offer as the edit started; edits are measured against it, never a
// later read.
const [editBaseline, setEditBaseline] = useState<OfferOption | null>(null);

function editOffer() {
  if (!offer || offer.origin !== 'OWN') return;
  setEditBaseline(offer);
  setValues({
    offerMode: 'editing',
    offerName: offer.name ?? '',
    ...offerTermValues(offer, { curveId: form.getValues('curveId') }, remunerations),
  });
}

/** The typed terms become a copy of the edited offer. */
function saveAsNewOffer() {
  if (!editBaseline) return;
  setValues({ offerMode: 'new', copiedOfferId: editBaseline.id });
  setEditBaseline(null);
}

/** Back to the saved terms; the investment keeps its edits. */
function discardOfferEdits() {
  if (editBaseline) chooseOffer(editBaseline);
  setEditBaseline(null);
}

/** Restarts the edit from the version saved elsewhere. */
function reloadEditedOffer(fresh: OfferOption) { /* editOffer from fresh */ }
```

Also returned: `recalculatesOtherSimulations` (from `changesOfferTerms`
against the baseline) and `changesIndex` (the baseline kind's index differs
from the current kind's, both read from `remunerations`).

`simulations/feature/use-simulation-offer-saving.ts`: separate `create` and
`edit` mutations (`retry: 0`), and one `save()` that the workspace and the
creation hooks call before the simulation request:

```ts
save(values, editBaseline, callbacks): Promise<SimulationFormValues | null>
// existing: returns values.
// new: createOffer, toast, onOfferSaved(id), returns savedOfferValues().
// editing: offerEdit(editBaseline, toEditedOfferValues(values)); when it
//   changes no field, skips the request. Otherwise editOffer and invalidates
//   offerKeys.all and simulationKeys.all, as the offer editor does.
//   onOfferSaved(editBaseline.id); returns { ...values, offerMode: 'existing' }.
// failure: onProblem(describeSaveProblem(error, values.offerMode)), returns null.
```

`simulations/utils/simulation-save-problem.ts`: term fields point at the
typed field in `editing` as in `new`. `conflict` becomes
`conflict: 'simulation' | 'offer' | null`, since `OFFER_REVISION_CONFLICT`
is recovered differently (reload the offer, keep the investment).

`simulations/feature/use-simulation-workspace.ts` `run()`: offer first,
because the simulation's checks (minimum term, investment before maturity)
read the saved terms; then the simulation `PATCH` only when its own fields
changed (`offerId`, `principal`, `investmentDate`, `curveId` against the
values it was saved with). When the offer edit was the only change, call
`onSaved(chosen, baseRevision)` without a request. Check whether an offer
edit changes the simulation's revision; if it does, the next simulation
edit must not report a conflict that is its own.

`simulations/feature/use-simulation-creation.ts`: the same `save()` before
`createSimulation`.

`simulations/feature/simulation-form-panel.tsx`

- `ChosenOffer`: `[PencilIcon] Editar oferta` first, only for an own offer
  that is not deleted.
- `EditedOfferFieldset` (new component in the file): legend
  `[OfferIcon] Oferta · Editando`, title type as fixed text, issuer, name,
  remuneration, rate, maturity, and liquidity; no offer picker. Focus moves
  to the issuer when it mounts (a ref callback, not an effect). The
  consequence line is the warning (`AlertTriangleIcon`, warning token) when
  `recalculatesOtherSimulations` and the count is above zero, with the
  index sentence when `changesIndex`; otherwise the neutral line with
  `InfoIcon`: "As alterações valem para a oferta em todas as simulações que
  a usam." While the count loads or fails, the warning shows without a
  number and never blocks saving. Buttons `[CopyIcon] Salvar como nova
  oferta` and `[XIcon] Descartar alterações da oferta` (quiet, not
  destructive); focus returns to the section's first button.
- Offer conflict: the fieldset shows "Esta oferta foi alterada em outro
  lugar." with `[RefreshIcon] Recarregar oferta`, on save or as soon as the
  polled workspace offer's revision passes the baseline's.
- Save hint in `editing`: "Salvar altera a oferta e recalcula esta
  simulação." or "…esta e outras N simulações."

## Delivery

One PR: the `excludingId` filter, the hidden-curve fix, and the screen
changes together.

## Verification

- **Hooks:** `use-simulation-form.spec.ts` (enter edit, save as new,
  discard, reload); `use-simulation-workspace.spec.tsx` (offer only: one
  `PATCH /offers`; offer and investment: offer then simulation; offer
  rejected: nothing else sent; offer saved, simulation rejected: offer
  chosen, investment still dirty; offer conflict; no duplicate request on a
  double click); `use-simulation-creation.spec.tsx` (edit, then create).
- **Helpers:** `simulation-form.spec.ts` for `toEditedOfferValues` and the
  dropped curve.
- **API:** `list-simulations.query-handler.integration.spec.ts`,
  `excludingId` with `offerId` for both the page and the total.
- **Checks:** `pnpm check:integration`.
- **Local stack:** edit an offer used by three simulations from one of them;
  check the `OfferTermsChanged` outbox row, the other two recalculating to
  "Atualizado", and a CDI-to-SELIC edit leaving them in "Requer ação".
- **Browser:** the checks in "Testing and verification" in
  `docs/architecture/frontend-patterns.md`, at 390px and 1024px, for each
  mode, the warning, the conflict, and the half-saved path.

## Docs on ship

- `docs/implementation/current-state.md`: the workspace edits its own offer;
  drop the "Differs From the Target Model" bullet; rename "Digitar termos".
- `docs/architecture/recalculation.md`: rename "Digitar termos" in the
  status paragraph.
- `docs/README.md`: drop this file from the planned list, and delete it.

## Done when

The PR is merged, the workspace and the new-simulation page match
"Simulação" in the screens doc, and the docs above are updated.
