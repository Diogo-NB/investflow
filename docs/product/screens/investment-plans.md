# Investment Plan Behavior

Recorded 2026-10-27 and implemented under `/planos`; the "Resumo"
block was added 2026-10-28. A plan has a name,
an optional description, an owner, a revision, and up to 50 of the owner's
simulations: the ones they would invest in together. Business rules are in
"Planos de Investimento" in the [PRD](../investment-simulator-prd.md).

- Routes under `/planos`: list, details (`/planos/:investmentPlanId`), create
  (`/planos/novo`), and editor (`/planos/:investmentPlanId/editar`). Each
  loads lazily; dialogs load on demand.
- The list shows the owner's plans by name, 20 per page (`page` URL
  parameter; a malformed page or one past the end is corrected by
  navigating), each with its description, simulation count, and status tags.
  It polls while any plan has a member calculating. The empty state explains
  that a plan gathers what is invested together, and that alternatives belong
  in the comparison.
- Status tags name each state with its count, in text and color: "Em
  atualização N", "Com pendência N", "Resultados desatualizados N". A plan
  whose results are all current shows none. While a premise change is being
  recalculated, its members count as outdated, not in update.
- Details show the name, the description, the status tags, "Editar", and
  "Excluir". The delete dialog says the deletion is permanent and that "As N
  simulações continuam em Simulações".
- "Resumo" sits between the status tags and the members, hidden while the
  plan has no members. It reads `totals` from the plan read itself, so the
  plan's polling refreshes it, and shows "Totais provisórios" while the
  totals are provisional (`totals.isProvisional`: some member is
  calculating, has a pending issue, or a stale result). Without any result
  it says "Nenhuma simulação tem
  resultado ainda."; otherwise it says "Valores no vencimento de cada
  simulação, sem reinvestimento." and, when some members have no result,
  "N simulações sem resultado ficam fora dos totais." Then come a row of
  values (Aplicado, IOF, IR, Montante líquido, Rendimento líquido, and the
  Período from the first investment to the last maturity), and the
  "Vencimentos" table and the "Liquidez" card, side by side from 1024px and
  stacked below. "Vencimentos" has one row per month with a maturity
  ("janeiro de 2027"), with the simulation count (under the month below
  640px), the net amount, and the running total. A month whose maturities
  have all passed (on or before today) carries "Vencido"; one where only
  some have passed, "N de M vencidas". It shows 6 rows, then "Mostrar todos
  (N)", which turns into "Mostrar menos".
  "Liquidez" splits the amount invested into "Diária" and "No vencimento",
  each in R$ and %, over a two-segment bar that repeats the text. Rules are
  in "Totais do Plano" in the PRD.
- "Simulações do plano" lists every member (one read of
  `GET simulations?investmentPlanId=&pageSize=100`, above the limit) in the
  simulation list's table and rows, with "Ordenar por" (`sort` URL parameter,
  shown from two members) and a "Remover do plano" action per row: a quiet
  ✕ icon in the table's last column (at the end of a row below 1280px) that
  turns to the error color only on hover, since the simulation is unlinked,
  not deleted. One removal at a time; a failed removal names the simulation. Selecting 2 to 6
  members shows the comparison bar, which opens
  `/simulacoes/comparar?ids=…`; the selection is not kept in the URL. The
  page polls the plan and its members while any member is calculating.
- "Adicionar simulações" opens a dialog listing the owner's simulations,
  20 per page, with the simulation list's filter bar (search, filters, and
  "Ordenar por"; see [Simulation Workspace Behavior](./simulations.md)) held
  in the dialog instead of the URL; in the dialog's width the filters
  collapse behind "Filtros (N)". Changing a filter or the order returns to
  the first page and keeps the choice, including simulations the filters
  now hide. A filtered list with no rows says "Nenhuma simulação
  corresponde aos filtros." with "Limpar filtros", distinct from having no
  simulations. Members show checked and disabled ("já no
  plano"), and the choice stops at the plan's free slots. One request adds
  them all; a failure keeps the choice and shows the API's message. The
  dialog stays open while the add is pending.
- "Nova simulação" opens `/simulacoes/nova?plano=<id>`. Once the
  simulation is created, a toast offers to add it to the plan (see "Plans"
  in [Simulation Workspace Behavior](./simulations.md)); creating it never
  adds it on its own.
- A full plan disables "Adicionar simulações" and "Nova simulação" and says
  why: "O plano está cheio: 50 simulações, o máximo. Remova uma para incluir
  outra."
- The editor has the name (required, up to 100 characters) and the
  description (optional, up to 500), initialized once from one snapshot.
  Create and edit are separate requests; the edit sends the revision and
  only the changed fields. A revision conflict says the plan changed
  elsewhere and keeps the input until the user reloads; adding or removing
  members also changes the revision. Unsaved changes are confirmed before
  leaving.
- A missing or deleted plan has its own state, which says the simulations
  are still in Simulações.
