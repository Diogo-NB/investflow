# Simulation Workspace Behavior

Recorded 2026-10-11 for the redesigned model. Built so far: the offer choice,
"Duplicar e ajustar", "Digitar termos", one current result marked
"Desatualizado" when its premises changed, "Salvar e calcular" with the
revision, and the calculation status with its polling, "Tentar novamente",
the list's status tags, the list filters, the return rates, the remaining
term, and the list's return column and sorting. Not built yet: editing an own
offer in place from the workspace, with its impact notice. A
simulation always uses an offer, plus a curve when its
remuneration is indexed, and holds the principal and investment date. All of
them are editable. Its single result is recalculated asynchronously whenever
any of them changes.

- `/simulacoes` lists the user's simulations, 20 per page (`page` URL
  parameter, corrected by navigation when stale).
  - A filter bar of Base UI Selects narrows the list by offer, curve, title
    type, remuneration kind, and calculation status, with "Limpar filtros".
    The offer and curve choices come from the options query the workspace
    already caches; an offer or curve no longer listed shows as "Oferta
    excluída" or "Curva excluída". There is no index filter: the remuneration
    kind fixes the index. Offers that cannot be calculated yet stay
    selectable, and "Calculada" notes that it includes outdated results.
    Below 640px the filters collapse behind "Filtros (N)", N counting the
    active ones.
  - A status line above the list states the total ("N simulações", or "N
    simulações encontradas" when filtered) and "Atualizando simulações…"
    while a newer page or filter loads, during which the previous rows stay
    dimmed. Clearing the filters moves focus to it.
  - "Ordenar por" offers "Mais recentes" (the default) and "Maior
    rentabilidade líquida", which ranks by net annual return so the user can
    find the best option among many; simulations without a successful result
    come last, and an outdated one ranks by its last result, still tagged.
    It is the `sort` URL parameter (`netAnnualReturn`, omitted for the
    default), kept with the filters and reset to page 1 when changed. Sorting
    is not filtering: below 640px it stays visible beside "Filtros (N)",
    outside the collapsed filters, and does not count toward N.
  - The filters live in the URL under the API's names (`offerId`, `curveId`,
    `titleType`, `remunerationKind`, `calculationStatus`). Changing one
    resets to page 1, and an invalid value is dropped by navigating with
    `replace`. The list's parameters carry to a simulation's page and back
    to the list, including after deleting it.
  - A filtered list with no rows says "Nenhuma simulação corresponde aos
    filtros." with "Limpar filtros", distinct from having no simulations. Each row shows the offer
    (name and issuer, or "Sem emissor"), the remuneration, the curve
    when indexed, the principal, the period, the net value of the last
    successful result, its net annual return ("10,28% a.a.", or "—" without a
    successful result), and a textual status tag unless the result is up to
    date ("Calculando", "Requer ação", "Falha técnica"). Desktop
    uses a table with fixed column widths, the period on two lines; below
    1280px, labeled rows. The whole row or card opens the
    simulation: one link per entry, stretched over the table row on desktop.
  - Each row or card has a checkbox, "Comparar {oferta}", in place of the
    offer icon and above the stretched link. The selection is the `comparar`
    URL parameter (comma-separated ids, 2 to 6), kept across filters, sort,
    and pages, carried to a simulation and back, and changed with `replace`.
    At six, unticked boxes are disabled. While anything is selected, a bar
    sticks to the bottom of the list with "N selecionadas", "Limpar", and
    "Comparar", disabled below two with a hint; it sits in a live region
    mounted before the first selection.
- `/simulacoes/comparar?ids=…` compares 2 to 6 simulations, nothing stored.
  - It reads one screen query and polls every 3 seconds only while a
    simulation is calculating. A deleted or unknown id answers 404 and the
    screen says one simulation was not found, linking back to the selection.
    Fewer than two valid ids return to the list with them selected; malformed
    ids are dropped with `replace`.
  - A verdict on top answers which one yields the most: the leader by net
    annual return (ties named together), the gap of each other one in p.p.,
    and in R$ only when the server marks the amounts comparable (same
    principal, investment date, and maturity). It says when only one has a
    result, names those without one, and calls the comparison provisional
    while any simulation is not up to date. Outdated results still rank,
    tagged "Resultado anterior".
  - Desktop shows a table, one column per simulation in the selection order
    so columns stay put while results arrive, with a sticky label column and
    row groups Premissas, Líquido, Tributos, and Bruto. Each column header
    links to the simulation, shows its position and status, and has a remove
    button. The ranked rows mark "Melhor" with text and an icon, and the gap
    below the others. Below 1024px the same simulations are ranked cards with
    the headline rate, net amount, IR, and liquidity, and a "Detalhes"
    disclosure with every row. "Mostrar só diferenças" hides rows whose shown
    values are all equal.
  - "Adicionar" and the breadcrumb return to the list with the selection.
    The workspace's "Comparar com…" opens the list with that simulation added
    to the selection.
- `/simulacoes/nova` and `/simulacoes/:id` show the inputs beside the results
  (stacked below 1024px):
  - "Oferta": chosen from the offers visible to the user (system and own)
    grouped by title type and origin ("CDB · Do sistema", "CDB · Minhas"),
    with the title type hinted with its income-tax treatment and minimum term
    from the options query. "Duplicar e ajustar" opens the offer's terms as an
    editable copy that becomes a private offer; "Digitar termos" creates a
    private offer (title type, optional issuer, name, terms). Either is created
    together with the simulation when it is saved. The user's own chosen offer
    can also be edited in place, with the offer editor's impact notice; a
    system offer offers only "Duplicar e ajustar".
    Changing the remuneration kind clears the rate and the curve. Liquidity
    defaults to "No vencimento".
  - "Investimento": principal, investment date, and the curve for indexed
    kinds. The curve list is filtered by the offer's index and grouped by
    origin ("Do sistema", "Minhas"), auto-selects a sole curve, shows its
    coverage, and warns when the period may exceed it.
- The investment and maturity date pickers grey out weekends and holidays.
  `BusinessDateField` (in the library's `business-calendar/` folder, for any
  screen that needs business days) uses the shared business calendar (see
  Business rules and the business calendar) and limits its calendar to the
  accepted years; the browser holds no holiday rules. Typed dates are not blocked by the picker; the form rejects one outside
  the accepted years, and the request a non-business day, on its field. The INVALID notice for missing curve values
  links to the curve ("Ver curva <nome>").
- "Salvar e calcular" sends the simulation (with its revision when editing) and
  is disabled when nothing changed. A rejected request saves nothing: the form
  keeps its edits as unsaved changes and the reason appears on the responsible
  field (principal, non-business day, minimum term, index, missing offer
  or curve). A revision conflict says the simulation changed elsewhere and
  offers to reload. An accepted new simulation opens its own page, already
  waiting for its calculation.
- Status: the results panel always shows the calculation status and its
  cause in a live region ("Calculando · a curva CDI otimista foi alterada").
  The simulation's page polls its details query about every 3 seconds
  whatever the status, so finished calculations, edits from another tab, and
  premise changes all appear without special cases; TanStack Query pauses it
  while the tab is hidden and refetches on focus. A refetch updates the status
  and result panels, never the form: the editor is keyed by the simulation and
  each reload, not by revision, and saves with the revision it was loaded or
  last saved at (`PATCH` answers the new one). A poll showing a newer revision
  offers "Recarregar". The monthly balances
  query includes the result's `calculatedAt` in its key, so it refetches once
  per new result and never on an ordinary poll. Until the status is up to
  date, the panel shows the last successful result marked as predating the
  changes; a simulation that never succeeded shows only the status.
  - "Requer ação" shows the reason with its recovery: choose another curve
    or offer when one was deleted ("Sem curva, escolha outra", "Sem
    oferta, escolha outra"), or fix the field. A coverage gap names the first
    gap the API reports ("A curva não tem valores entre 02/01/2029 e
    28/12/2029 e em mais 2 períodos"); the domain groups consecutive missing
    rate references into ranges and the browser only phrases them.
  - "Falha técnica" explains that the automatic retries were exhausted and
    offers "Tentar novamente", which queues the calculation again.
- Remaining term: a saved simulation's results panel opens with its term
  above the status, in any status, because it depends only on the saved dates:
  "Vence em 14/10/2028 · faltam 1 ano, 11 meses e 28 dias", "Começa em
  03/11/2026 · prazo de 2 anos" before the investment date, "Vence hoje", and
  "Venceu em 14/10/2028" afterwards. The API returns the phase, the remaining
  calendar days, and their split into years, months, and days (the PRD's
  calendar-month rule), computed on today's UTC date; the browser only
  phrases them, dropping zero parts.
  An unsaved simulation shows no term.
- Results: the net value at maturity with its net annual return beside it
  ("10,28% ao ano, já descontados os tributos"), which answers the user's two
  first questions: how much they get and how good that is. Then the
  "Rentabilidade" block, then principal, gross balance, gross earnings, IOF,
  income tax, total taxes and net value, with the dates, business days,
  calculation instant in São Paulo time and the methodology version.
  "Evolução do saldo" is a disclosure.
- "Rentabilidade" is a small table with the rows "Ao ano", "Ao mês" and "No
  período" and the columns "Líquida" (first) and "Bruta", with two decimal
  places. When both are equal, as for LCI and LCA, it shows one column,
  "Líquida e bruta", noting the income-tax exemption instead of repeating
  numbers. "Como a rentabilidade é calculada" (with an info icon) opens a short
  Base UI Dialog in plain words: net means after IOF and income tax; "ao ano"
  spreads the period's return over 252 business days a year (naming the
  business days used); for a prefixed offer, that is why the gross annual
  return matches its rate, and for CDI or SELIC, the return follows the
  curve's values times the contracted percentage; "ao mês" is the equivalent
  constant monthly rate, not what each calendar month earned, which
  "Evolução do saldo" shows; and every rate assumes the money stays invested
  until maturity, since early redemption is not calculated yet. The rates
  belong to the result: they are marked as predating changes with it and
  hidden when there was never a successful result.
- "Evolução do saldo" opens with an area chart of each month's closing gross
  balance (compact BRL axis; the tooltip shows the exact closing balance and
  accumulated earnings), then lists one row per month (business days, the
  month's earnings, accumulated earnings and the closing gross balance). Each
  month's button (`aria-expanded`) reveals that month's business days beneath
  it.
- Taxes: the IOF and income-tax rows name the applied rate ("IOF · isento pelo
  prazo", "Imposto de renda · 22,5%", or "Imposto de renda · isento" for LCI
  and LCA, whose dialog section explains the exemption without a bracket
  table). "Como os tributos foram calculados" (with an info icon) opens a short
  Base UI Dialog: the holding period, then for IOF and income tax one sentence
  on the rule, the formula string the API writes from the result's recorded
  values (shown as is), and the table with the applied row marked "seu caso"
  (not by color alone). Rates and tables come from the API, which takes them
  from the domain; the browser only finds the applied row by rate.
- A saved simulation's header offers "Nova simulação" (a blank form at
  `/simulacoes/nova`), "Duplicar" and "Excluir".
- "Duplicar" opens `/simulacoes/nova?a-partir-de=:id` prefilled with the same
  offer, curve and investment, for side-by-side comparison. "Excluir"
  confirms in an AlertDialog and says the deletion is permanent. Unsaved edits
  are guarded by `useBlocker` and `beforeunload`.
- Reads are screen-oriented (Backend for Frontend): the options query (title
  types, remuneration kinds with their index, visible offers with their origin
  and calculability, visible curves with their origin and
  coverage), the workspace query (the simulation's references and
  investment, its status with any reason, its remaining term, and the last
  successful result with its return rates and the inputs it was computed
  from), and the monthly balances of the current
  result. The list has its own query. Writes create (optionally with a new
  private offer), edit with the revision, delete, and retry a
  failed calculation.
