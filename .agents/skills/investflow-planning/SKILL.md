---
name: investflow-planning
description: Plan, discuss, and close out InvestFlow work. Use when asked to plan or design a feature, refactor, or roadmap step (D-numbered items), to discuss or decide an architecture, modeling, or UX question, to present options, or to record decisions and update the roadmap, PRD, and architecture docs afterwards. Do not use for small mechanical edits, single bug fixes, or answering a factual question about the code.
---

# InvestFlow Planning

A plan is ready when the user can approve it without asking for the
implementation, the alternatives, a simpler option, or the docs it changes.
This skill decides how the work is shaped and presented; the layer skills
decide what the code looks like, and their rules limit which designs are
acceptable.

## Load the layer skills first

As soon as you know which layers the work touches, and before proposing
anything, load each one's skill with the Skill tool, following the routing
in "Agent Skills" in `AGENTS.md`: `investflow-domain-application` for
aggregates, use cases, ports, or repositories' contracts;
`investflow-nestjs-infrastructure` for persistence, queries, or endpoints;
`investflow-eventing` for any event; `investflow-react` for screens. The
edit hook does not cover planning, so nothing else loads them. Reading a
skill file with `cat` or `grep` does not count.

## Read first

Find what the work touches before reading, then read only that
(`docs/README.md` says what each file owns):

- The step's section and "Next Steps" in
  `docs/product/implementation-roadmap.md`, and the areas it touches in
  `docs/product/current-state.md`.
- The PRD or curve-specification sections for the business rules involved,
  and the screen file in `docs/product/screens/` for screen work.
- The architecture file of each area touched (`recalculation.md`,
  `messaging.md`, `queries.md`, `frontend-patterns.md`) and every
  `docs/architecture/deferred-work.md` item that names it.

Recorded decisions are revisable. Check whether their premises still hold
instead of building on them blindly, and say which parts of the area are
built, designed only, or newly proposed: "the docs say X" and "the code does
X" are different claims, so check the code.

## Decide the mode

The request sets how far to go. Respect it, and ask when it is unclear:

- **Discuss**: "lets discuss", "what is the problem", "analyze", "NO CODE
  YET", "dont edit, just report". Answer, propose, and stop. Do not write
  code or a plan file.
- **Plan**: "plan D7", "lets plan". Produce the plan below and wait for
  approval.
- **Implement**: "implement", "go ahead". Plan briefly when the design is
  settled; return to planning when a real design question appears.

When the user narrows the scope ("only step 1 + docs", "pin D4b"), plan only
that and record the remainder as deferred or as the next step.

## Shape the problem before the solution

For architecture, modeling, cross-cutting mechanisms, or screen design (not
routine work):

1. Restate what the work must achieve and the two or three questions that
   decide its shape. A design that answers those questions without
   discussing them is not ready.
2. Research before proposing. Name the established pattern that fits
   (transactional outbox, fan-out, saga, BFF, strategy, and so on), what it is
   known for, and where it fails. Search the web when the answer depends on
   current product behavior, such as an AWS service limit. Do not tune by
   trial and error what reasoning or a measurement can settle.
3. Judge at production scale, not by today's data volume (see "Project
   Overview" in `AGENTS.md`).

## Present options

For any decision that is not obvious, present two or three real options
(not one option plus straw men) against the same criteria. Typical criteria:
clarity of the model, hexagonal boundaries, behavior at scale, user
experience, and the size of the change. Mark one as **recommended** and say
why. When the user proposes an option, evaluate it with the same rigor as
your own, then compare it to them.

### Simplicity pass

Before presenting, name the simplest option that meets the goal and justify
anything heavier. Reject what the user has rejected before:

- machinery the infrastructure already provides (queue visibility timeouts,
  FIFO groups, database constraints, `updatedAt` instead of a new protocol);
- a new aggregate, table, or status where a column or a derived value works;
- copies of data that can be referenced;
- paging, caching, generalization, or configurability with no current need
  (record it as deferred work instead).

### Open questions

Ask open decisions in prose as a numbered list, one question each, with
your recommendation and its tradeoff, so the user can answer by number
("1. a, 2. agreed"). Use a structured question tool only for a single
blocking choice between short labels. Before handing a plan over, resolve
what you can yourself and ask only what is genuinely the user's call.

## Write the plan

Order the plan so the most consequential part comes first:

1. **Goal and scope**: what ships, what is out of scope, what is deferred.
2. **Model**: for domain work, the types, the PRD vocabulary they encode,
   what is stored versus derived, and how per-type variation is carried (see
   "Model review" in `investflow-domain-application`). For eventing, the
   events (named after business facts), their producers, consumers, and
   queues. For screens, the user's task and the query each screen reads.
3. **Implementation**: per-file code sketches of the types, signatures, and
   orchestration, grouped by layer. A file list alone is not a plan. Sketch
   the non-obvious parts in full: use-case flows, concurrency, error paths,
   and anything with numbers (limits, timeouts, batch sizes) with the
   reasoning behind each number.
4. **Delivery**: when the work is large, split it into PRs that each build
   and pass tests on their own (PR A, B, C), in dependency order.
5. **Verification**: the tests to add and how the change will be tested on
   the local stack (see `investflow-local-testing`).
6. **Docs**: the docs and skills the change updates (see "Close out").

## Self-review before presenting

The user should not have to ask "why didn't you catch this when planning?".
Before presenting, run the "Before finishing" list of every layer skill the
plan touches against the sketches, and check the plan for:

- any option, recommended or not, that breaks a skill rule, such as two
  aggregates changed in one use case or transaction. Existing code that
  breaks a rule is a finding to report, not a precedent to follow; if every
  option breaks a rule, say so and ask;
- an obstacle in existing code that the plan works around instead of
  analyzing: the obstacle is often the real finding, such as a form whose
  save state does not match the server's commit;
- dead mechanisms, duplicate entry points, or two methods doing one job;
- one operation hidden behind a discriminator, mode flag, or `kind` field;
- names that do not say what the thing is and where it applies (see the
  naming rule in "Coding Conventions" in `AGENTS.md`): read each new type,
  method, event, endpoint, route, and file name as a newcomer would;
- knowledge on the wrong side of a port (a transport limit or timeout in
  application code, persistence in a domain service);
- rules the plan states but no file in the sketches implements;
- the same discriminant checked twice in one flow.

Fix what you find; do not list it as a caveat.

## Close out

After a decision is agreed or an implementation lands, update the docs in
the same change. The user should never have to ask whether the docs are up
to date:

- **Roadmap**: "Next Steps" and the step's section. Mark settled points,
  paused steps (with the date), and what remains; remove a step's section
  once it ships.
- **Current State**: what the change built or changed, in
  `docs/product/current-state.md`.
- **Screens**: user-visible behavior of a screen, in its
  `docs/product/screens/` file.
- **PRD**: whenever a business rule, requirement, or user-visible behavior
  changed, even if the change came from a technical discussion.
- **Architecture docs**: record decisions with their date in the file that
  owns the area (`docs/README.md`), the Event Catalog for any event change,
  and the matching one-line invariant in `AGENTS.md` when one exists.
- **Deferred Work**: add each consciously postponed item to
  `docs/architecture/deferred-work.md` with its date, the reason, and when to
  revisit it. Remove an item when it ships.
- **Skills**: when a coding convention changed, update the skill that owns
  it (coding rules live in skills, not docs). When files move to another
  skill, update the "Agent Skills" routing in `AGENTS.md` and the hook's
  `ROUTES` together.

Then re-read the changed docs once against each other: the same fact must
not be stated differently in two places.

## Turning corrections into rules

When the user corrects a plan or code in a way a rule would have prevented,
propose the rule, then write it so the skill does not just grow:

1. Find the rule it generalizes in the owning skill (or `AGENTS.md` for a
   rule every task needs) and edit that one instead of appending a new one.
2. State the principle with the user's case as the example.
3. When the same mistake has happened before, add it to the skill's "Before
   finishing" list.
4. When a skill passes about 12 KB, condense it: merge rules that say the
   same thing and move material only some tasks need into `references/`.
