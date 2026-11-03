# Home Overview Query

> **Status: postponed.** The home shipped (2026-11-03) on the existing list
> endpoints. Revisit when the home's requests show up in API load or page
> latency, or when it needs a count the lists cannot give in one request.
> Delete this file once it ships.

The home is described in
[screens/app-shell.md](../../product/screens/app-shell.md).

## Today

The home reads four existing lists in parallel: the 5 most recent
simulations, the first by net annual return, the simulations requiring
action (`pageSize=1`, only for `total`), and the first 3 plans. Each runs
its own count query, and the home shows only the action-required count;
"Falha técnica" would cost one more request.

## Scope

- A screen-oriented `GET /investment-simulator/simulation-overview` (name to
  confirm) returning, for the owner, the count of simulations per
  calculation status, the recent simulations, and the best result, computed
  in one query (see [queries.md](../../architecture/queries.md)).
- The home switches to it and shows every unsettled status it returns.

## Done when

- The home makes one simulation request instead of three, with the same
  behavior, and this file is deleted.
