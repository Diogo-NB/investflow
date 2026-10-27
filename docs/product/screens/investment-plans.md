# Investment Plan Behavior

Recorded 2026-10-27 and implemented under `/planos` (D9). A plan has a name,
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
  recalculated, its members count as outdated, not in update (see
  "Recalculation status on screen" in
  [Deferred Work](../../architecture/deferred-work.md)).
- Details show the name, the description, the status tags, "Editar", and
  "Excluir". The delete dialog says the deletion is permanent and that "As N
  simulações continuam em Simulações".
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
  newest first, 20 per page. Members show checked and disabled ("já no
  plano"), and the choice stops at the plan's free slots. One request adds
  them all; a failure keeps the choice and shows the API's message. The
  dialog stays open while the add is pending.
- "Nova simulação" opens `/simulacoes/nova?plano=<id>`. Adding the new
  simulation to the plan from there is not built yet (roadmap D9).
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
