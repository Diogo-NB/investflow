# Curve End Extension Recalculation

> **Status: postponed (2026-11-04).** Left out of the Banco Central import to
> keep that change small. Revisit next, since the import makes this cost recur
> daily. Delete this file once it ships.

Any change to a curve's intervals raises `valuesRevision` and
`CurveValuesChanged`, including moving the last interval's end with the same
value. That move changes no date's value, because the last value already holds
after the end, so no result can change.

The import extends the last end each business day it finds a new value. Until
this ships, each of those days recalculates every simulation on the CDI and
SELIC system curves through the fan-out, and they get the same results. The
product rule is to recalculate only when the rate changes (see "Curvas do BCB"
in the [curve specification](../../product/index-value-curves.md)).

## Scope

- Applying published values with an unchanged value raises `revision` only,
  with no `valuesRevision` increment and no `CurveValuesChanged`; opening a new
  interval raises both.
- `Curve.edit()` stays as it is unless a decision says otherwise: treating an
  edit the same way means comparing the value of each date, including gaps and
  changes to the first interval. A user moving an end date only causes a
  harmless recalculation.
- The workspace already reads `lastIntervalEnd` from the curve, so results need
  no recalculation to show the new date.

## Done when

An import with no rate change queues no recalculation, a rate change still
does, tests cover both, and this file is deleted.
