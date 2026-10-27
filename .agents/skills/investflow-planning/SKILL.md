---
name: investflow-planning
description: Plan, discuss, and close out InvestFlow work. Use when asked to plan or design a feature, refactor, or roadmap step (D-numbered items), to discuss or decide an architecture, modeling, or UX question, to present options, or to record decisions and update the roadmap, PRD, and architecture docs afterwards. Do not use for small mechanical edits, single bug fixes, or answering a factual question about the code.
---

# InvestFlow Planning

A plan is ready when the user can approve it without asking for the
implementation, the alternatives, a simpler option, or the docs it changes.
Load the layer skills the work touches alongside this one; this skill decides
how the work is shaped and presented, they decide what the code looks like.

## Read first

- `docs/product/implementation-roadmap.md` for the D-numbered step, its
  settled and open points, and what is paused.
- `docs/product/investment-simulator-prd.md` for the business rules.
- `docs/architecture/project-structure.md` (decisions and "Deferred Work"),
  plus `event-flow.md` or `frontend-patterns.md` when the work touches them.

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
   "Model review" in `$investflow-domain-application`). For eventing, the
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
   the local stack (see `$investflow-local-testing`).
6. **Docs**: the docs and skills the change updates (see "Close out").

## Self-review before presenting

The user should not have to ask "why didn't you catch this when planning?".
Before presenting, run the review rules of every skill the plan touches
against the sketches, and check the plan for:

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

- **Roadmap**: "Current State", "Next Steps", and the step's section. Mark
  settled points, paused steps (with the date), and what remains.
- **PRD**: whenever a business rule, requirement, or user-visible behavior
  changed, even if the change came from a technical discussion.
- **Architecture docs**: record decisions with their date in
  `project-structure.md`, `event-flow.md`, or `frontend-patterns.md`, and
  update the matching invariant in `AGENTS.md` when one exists.
- **Deferred Work**: add each consciously postponed item to
  `project-structure.md` with its date, the reason, and when to revisit it.
  Remove an item when it ships.
- **Skills**: when a convention changed, update the skill that teaches it.

Then re-read the changed docs once against each other: the same fact must
not be stated differently in two places.

When the user corrects the plan or the code in a way a rule would have
prevented, propose the rule for the matching skill or `AGENTS.md`.
