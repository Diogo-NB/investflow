# Curve Values Source Label

> **Status: postponed (2026-11-04).** Left out of the Banco Central import,
> which works without it. Revisit whenever the curve screens next change.
> Delete this file once it ships.

The curve specification says the screens show where a curve's values come from
(see "Curvas do BCB" in
[the curve specification](../../product/index-value-curves.md)). Today the
details screen says only "Do sistema, somente leitura". The last published date
needs nothing new: it is the coverage end date the screens already show.

## Scope

- The curve query returns a `source` for the system curves the import updates
  (`CDI` and `SELIC`), computed on the server.
- The curve details screen shows one label with it.

## Done when

The details of the `CDI` and `SELIC` system curves name the Banco Central, other
curves do not, and this file is deleted.
