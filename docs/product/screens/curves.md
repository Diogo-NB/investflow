# Curve Behavior

Recorded 2026-10-11 and implemented under `/curvas` (D6). A curve has an
index (which fixes the value convention), a name, an optional description,
intervals with values, an owner, and a revision. Alternatives of one index are
separate curves; screens group them by index and origin, and nothing about the
grouping is stored. Visibility and ownership follow [Offer Behavior](./offers.md).

- Routes under `/curvas`: list, curve details, create, and editor. Each loads
  lazily. Confirmation dialogs load on demand.
- The list shows the curves visible to the user grouped by index, then by
  origin ("Do sistema", "Minhas"), sorted by name, with each curve's coverage
  (first and last dates; a curve has no gaps). The `index` URL parameter
  filters it and carries through to detail and editor links and back; an
  unknown value is dropped through navigation. The list is not paginated.
  "Nova curva" from a filtered list starts with that index.
- Details show the index, convention, coverage, origin, and description, a
  step line chart of the values over time above the intervals table (each step
  runs until the next interval starts, a zero
  line appears when a value is negative, and the hovered interval's exact value
  and dates show in a strip above the plot, never over the axis, for mouse and
  keyboard alike), and "Simulações com esta curva" with the same reads,
  states, and "Ver todas (N)" link (`/simulacoes?curveId=<id>`) as offers.
  Own curves offer "Editar", "Duplicar" and "Excluir". A system curve shows a
  "Curva do sistema: somente leitura" notice and offers only "Duplicar", as
  its primary action. "Duplicar" creates a private copy named "<nome>
  (cópia)" with the same index and content.
- The editor edits the name, description, and intervals; the index is chosen
  only on creation, where it starts unselected (or with the list's `index`
  filter) and the rows appear once it is chosen. Creating also offers "Copiar
  intervalos de": a base curve, filtered by the chosen index, whose choice
  sets the index and replaces the rows. Intervals are an editable row table
  (decision 2026-10-13): one row per interval with start, end, and value, all
  inclusive. CDI and SELIC rows take dates, whose pickers offer only business
  days within the row's limits: an end picker opens on its start's month and
  offers nothing before the start (a one-day interval stays possible) or
  from the next row's end on, and a start picker offers nothing up to the
  previous row's start or after its own end (typed dates are not blocked;
  changing a start checks a filled end at once), and an annual rate in percent, never
  negative; IPCA rows take MM/AAAA months (first to last day) and a monthly
  variation in percent above -100%, which may be negative. Switching between
  daily and monthly indexes on creation clears the rows.
- Rows stay contiguous as they are edited (pure row operations in
  `curve-form.ts`, tested without React):
  - Changing an end moves the next row's start to the following business day
    (or month); changing a start moves the previous row's end to the business
    day (or month) before it.
  - Removing a row between two others makes the previous one run until the
    next starts. Removing the first or last row shortens the curve, never
    stretching a neighbor over the removed days.
  - "Dividir em dois" splits a row at the month start nearest its middle (its
    middle business day, or month, when it lies within one month); both
    halves keep the value and the second one's value gets focus.
  - "Adicionar intervalo" starts the new row right after the last one and
    guesses its end as that month's last business day (or the same month),
    focusing the value. A value field suggests the previous row's value as
    its placeholder.
  - Removing a row, switching between daily and monthly indexes with rows
    filled, or copying a base curve over typed rows offers "Desfazer", right
    under the rows, until the next edit or save. Removing moves focus to
    "Desfazer"; undoing moves it to the restored row.
  - After rows are added, split, removed, or restored, only the rules between
    rows and the fields already in error are re-checked, so a new row's empty
    fields stay quiet until the next save.
  - Overlaps and missing business days (or months) are flagged on the later
    row with the API's message and a one-click "Começar em <data>" fix. Typing
    alone cannot open a gap, since rows follow each other; the message and fix
    are for rows loaded with one, or a gap the API reports. A
    typed weekend or holiday shows "Não é dia útil." without blocking. At
    least one row is required. A live summary states the coverage (months for IPCA). On phones each row has
    a visible "Intervalo N" heading and its actions show their names. Observed
    and projected values are not distinguished yet (open question in the
    curve specification).
- The editor follows the offer editor's impact notice, revision conflict, and
  save rules. Its notice appears only while the edit changes the intervals
  and reads "As N simulações que usam esta curva serão recalculadas."
  ("A simulação que usa esta curva será recalculada." for one); editing only
  the name or description shows no notice. The PATCH sends only changed fields, comparing
  intervals after the same conversion and ordering, so retyping a value
  identically changes nothing.
- Deleting a curve states how many of the user's simulations will require a
  new choice ("Sem curva, escolha outra"). Its copies are not affected.
