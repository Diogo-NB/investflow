# Offer Behavior

Recorded 2026-10-11 and implemented under `/ofertas` (D5). An offer has a title type
(fixed after creation), a name, an optional issuer, remuneration and rate,
maturity, liquidity, an owner, and a revision. User content is private and
editable; system content is visible to everyone and read only. Offers are
independent; the screens group them, and no grouping is stored.

- Routes under `/ofertas`: list, details, create, and editor. Each loads
  lazily. Confirmation dialogs load on demand.
- The list shows the offers visible to the user grouped by title type and
  origin ("Do sistema", "Minhas"), each with its name, issuer, and terms.
  Filters are the `q` (name or issuer), `titleType`, `origin` ("Do
  sistema" or "Minhas"), and `page` URL parameters. A submitted search or a
  changed filter resets to page 1. These
  parameters carry through to detail and editor links and back to the list.
  The page size is fixed at 20. Obsolete reads are canceled. A stale page
  beyond the last page is corrected through navigation.
- Details show the offer's exact terms in a definition list. Own offers offer
  "Editar", "Duplicar" and "Excluir"; system offers offer "Duplicar", which
  creates a private copy. A missing or deleted record has its own state.
- "Simulações com esta oferta" on the details lists the first 20 of the
  user's simulations that use it, each opening `/simulacoes/:simulationId`,
  then "Ver todas (N)" to `/simulacoes?offerId=<id>`. It reads the filtered
  simulation list (first page, 20 per page, the same read as that link's
  first page), whose total is the N used by the delete dialog and the editor
  notice, and it has its own loading, empty, and failure states with retry.
- Deleting confirms in an AlertDialog that states the deletion is permanent and
  that "N simulações ficarão sem oferta (Sem oferta, escolha outra)".
- The editor initializes from one snapshot. The title type is displayed as
  fixed information. Changing the remuneration kind clears the rate, because
  its unit changed. Before saving, it states how many of the user's
  simulations use the offer, only while the edit changes the terms (maturity,
  remuneration): "As N simulações que usam esta oferta serão recalculadas."
  ("A simulação que usa esta oferta será recalculada." for one). Editing only
  the name, issuer, or liquidity, or an offer no simulation uses, shows no
  notice. A rate not yet valid counts as a terms change.
  A system offer has no editor; its details offer only "Duplicar". The PATCH sends the edited revision and
  only changed fields. A revision conflict says the offer changed elsewhere
  and keeps the user's input until they reload. A successful save clears the
  dirty baseline before redirecting to a fresh detail read. A failed detail
  read after save is a read failure, not permission to repeat the write.
- Pure helpers shift decimal strings to convert percentages and fractions. They
  reject zero, invalid input, and values outside Decimal(65,30) storage.
  Calendar validation and `dd/mm/aaaa` display never construct local-time
  instants.
- Browser and API verification uses dedicated test offers. It doesn't reset
  local databases or change Keycloak accounts.
